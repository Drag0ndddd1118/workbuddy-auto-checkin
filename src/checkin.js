/**
 * WorkBuddy / CodeBuddy Check-in & Points Query Module
 * Pure Node.js built-in API (zero dependencies)
 */

async function fetchWithRetry(url, options, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const resp = await fetch(url, options);
      let data = null;
      try {
        data = await resp.json();
      } catch (err) {
        throw new Error(`HTTP ${resp.status} - 返回非 JSON 数据`);
      }
      return { status: resp.status, data };
    } catch (err) {
      if (attempt < retries) {
        const delay = attempt * 2000;
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
}

/**
 * 查询账号全量资源包可用总积分
 */
async function getUserTotalCredits(account) {
  const domain = account.domain || 'www.codebuddy.cn';
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${account.token}`,
    'X-User-Id': account.uid,
    'X-Domain': domain
  };

  try {
    const { status, data } = await fetchWithRetry(`https://${domain}/v2/billing/meter/get-user-resource`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        PageNumber: 1,
        PageSize: 100,
        ProductCode: 'p_tcaca',
        Status: [0, 3],
        OnlyValidPeriod: true
      })
    });

    if (status === 200 && data?.code === 0) {
      const packages = data.data?.Response?.Data?.Accounts || [];
      let total = 0;
      for (const pkg of packages) {
        total += (pkg.CapacityRemain || 0);
      }
      return total;
    }
  } catch (_) {}
  return null;
}

/**
 * 执行账号签到与状态查询
 */
async function processAccount(account, options = {}) {
  const checkOnly = options.checkOnly || false;
  const domain = account.domain || 'www.codebuddy.cn';
  const name = account.name || account.nickname || account.uid || '未知账号';

  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${account.token}`,
    'X-User-Id': account.uid,
    'X-Domain': domain
  };

  // 1. 查询签到活动状态
  const statusUrl = `https://${domain}/v2/billing/meter/checkin-activity-status`;
  const { status: qStatus, data: qData } = await fetchWithRetry(statusUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({})
  });

  if (qStatus !== 200 || qData?.code !== 0) {
    throw new Error(`查询状态失败: ${qData?.msg || 'HTTP ' + qStatus}`);
  }

  const activity = qData.data || {};
  let totalCredits = await getUserTotalCredits(account);

  // 如果仅查询模式或今日已签到
  if (checkOnly || activity.today_checked_in) {
    return {
      name,
      uid: account.uid,
      status: activity.today_checked_in ? 'already_checked' : 'pending',
      message: activity.today_checked_in ? '今日已签到' : '今日未签到',
      credit: 0,
      streak: activity.streak_days || 0,
      seasonCredits: activity.total_credits || 0,
      totalCredits: totalCredits ?? (activity.total_credits || 0)
    };
  }

  // 2. 执行每日签到
  const checkinUrl = `https://${domain}/v2/billing/meter/daily-checkin`;
  const { status: cStatus, data: cData } = await fetchWithRetry(checkinUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({})
  });

  if (cStatus === 200 && cData?.code === 0) {
    const earned = cData.data?.credit || 100;
    // 重新获取签到后的可用总额
    totalCredits = await getUserTotalCredits(account);
    return {
      name,
      uid: account.uid,
      status: 'success',
      message: '签到成功',
      credit: earned,
      streak: cData.data?.streak_days || ((activity.streak_days || 0) + 1),
      seasonCredits: (activity.total_credits || 0) + earned,
      totalCredits: totalCredits ?? ((activity.total_credits || 0) + earned)
    };
  } else if (cData?.code === 10001) {
    return {
      name,
      uid: account.uid,
      status: 'already_checked',
      message: cData.msg || '今日已签到，请明天再来',
      credit: 0,
      streak: activity.streak_days || 0,
      seasonCredits: activity.total_credits || 0,
      totalCredits: totalCredits ?? (activity.total_credits || 0)
    };
  } else {
    throw new Error(cData?.msg || `签到失败 (code=${cData?.code}, status=${cStatus})`);
  }
}

module.exports = {
  processAccount,
  getUserTotalCredits
};
