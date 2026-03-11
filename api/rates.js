const { createClient } = require('@supabase/supabase-js');

function client() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
}

const DEFAULTS = {
  peakWeekend:   800,
  peakMidweek:   600,
  shoulder:      465,
  green:         200,
  cleaningFee:   60,
  serviceRate:   10,
  extraGuestFee: 50,
};

function toJS(row) {
  if (!row) return DEFAULTS;
  return {
    peakWeekend:   Number(row.peak_weekend    || DEFAULTS.peakWeekend),
    peakMidweek:   Number(row.peak_midweek    || DEFAULTS.peakMidweek),
    shoulder:      Number(row.shoulder        || DEFAULTS.shoulder),
    green:         Number(row.green           || DEFAULTS.green),
    cleaningFee:   Number(row.cleaning_fee    || DEFAULTS.cleaningFee),
    serviceRate:   Number(row.service_rate    || DEFAULTS.serviceRate),
    extraGuestFee: Number(row.extra_guest_fee || DEFAULTS.extraGuestFee),
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const sb = client();

  if (req.method === 'GET') {
    const { data, error } = await sb
      .from('rates')
      .select('*')
      .eq('id', 1)
      .single();
    if (error && error.code !== 'PGRST116') {
      return res.status(500).json({ error: error.message });
    }
    return res.status(200).json(toJS(data));
  }

  if (req.method === 'POST') {
    const r = req.body;
    const { data, error } = await sb
      .from('rates')
      .upsert({
        id:              1,
        peak_weekend:    Number(r.peakWeekend   || DEFAULTS.peakWeekend),
        peak_midweek:    Number(r.peakMidweek   || DEFAULTS.peakMidweek),
        shoulder:        Number(r.shoulder      || DEFAULTS.shoulder),
        green:           Number(r.green         || DEFAULTS.green),
        cleaning_fee:    Number(r.cleaningFee   || DEFAULTS.cleaningFee),
        service_rate:    Number(r.serviceRate   || DEFAULTS.serviceRate),
        extra_guest_fee: Number(r.extraGuestFee || DEFAULTS.extraGuestFee),
      })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(toJS(data));
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
