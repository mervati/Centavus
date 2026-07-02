export function getIRRate(days) {
  if (days <= 180) return 0.225
  if (days <= 360) return 0.20
  if (days <= 720) return 0.175
  return 0.15
}

export function getIRLabel(days) {
  if (days <= 180) return '22,5%'
  if (days <= 360) return '20%'
  if (days <= 720) return '17,5%'
  return '15%'
}

export function daysSince(dateStr) {
  if (!dateStr) return 0
  const start = new Date(dateStr + 'T12:00:00')
  const today = new Date()
  return Math.max(0, Math.floor((today - start) / (1000 * 60 * 60 * 24)))
}

export function calcYieldInfo(s, fullBalance, fullSavings) {
  const active = s?.yield_type && s.yield_type !== 'none'
  if (!active || !s.yield_start_date) {
    return { active: false, netBalance: fullBalance, netSavings: fullSavings, grossYieldBank: 0, grossYieldSavings: 0, irLabel: '' }
  }

  const days = daysSince(s.yield_start_date)
  const irRate = getIRRate(days)
  const irLabel = getIRLabel(days)

  const grossYieldBank    = Math.max(0, Number(s.initial_balance)  - Number(s.yield_start_balance  || 0))
  const grossYieldSavings = Math.max(0, Number(s.savings_initial)  - Number(s.yield_start_savings  || 0))

  const netBalance = fullBalance - grossYieldBank    * irRate
  const netSavings = fullSavings - grossYieldSavings * irRate

  return { active: true, netBalance, netSavings, grossYieldBank, grossYieldSavings, irLabel }
}
