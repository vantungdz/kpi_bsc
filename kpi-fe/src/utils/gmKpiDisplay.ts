/** Pure helpers dùng chung GM layout (drawer + bảng chẩn đoán). */

export function getStatusColor(status: string) {
  switch (status) {
    case 'fail':
      return 'text-rose-700'
    case 'warn':
      return 'text-yellow-700'
    case 'active':
      return 'text-blue-700'
    case 'pass':
      return 'text-emerald-700'
    default:
      return 'text-slate-600'
  }
}

export function getStatusBg(status: string) {
  switch (status) {
    case 'fail':
      return 'bg-rose-100/60'
    case 'warn':
      return 'bg-yellow-100/60'
    case 'active':
      return 'bg-blue-100/60'
    case 'pass':
      return 'bg-emerald-100/60'
    default:
      return 'bg-slate-100'
  }
}

export function getStatusIcon(status: string) {
  switch (status) {
    case 'fail':
      return '❌'
    case 'warn':
      return '⚠'
    case 'active':
      return '📈'
    case 'pass':
      return '✅'
    default:
      return ''
  }
}

export function getStatusBadge(status: string) {
  switch (status) {
    case 'fail':
      return {
        bg: 'bg-rose-200/50',
        text: 'text-rose-700',
        border: 'border-rose-300',
        label: 'Failed (At Risk)',
      }
    case 'warn':
      return {
        bg: 'bg-yellow-200/50',
        text: 'text-yellow-700',
        border: 'border-yellow-300',
        label: 'Warning',
      }
    case 'active':
      return {
        bg: 'bg-blue-100/80',
        text: 'text-blue-700',
        border: 'border-blue-200',
        label: 'On Track',
      }
    case 'pass':
      return {
        bg: 'bg-emerald-100/80',
        text: 'text-emerald-700',
        border: 'border-emerald-200',
        label: 'Healthy',
      }
    default:
      return {
        bg: 'bg-slate-100',
        text: 'text-slate-600',
        border: 'border-slate-200',
        label: 'Unknown',
      }
  }
}

export function getRowClass(status: string) {
  switch (status) {
    case 'fail':
      return 'bg-rose-100/60 hover:bg-rose-100 border-rose-300 border-l-4 border-l-rose-500'
    case 'warn':
      return 'bg-yellow-100/60 hover:bg-yellow-100 border-yellow-300 border-l-4 border-l-yellow-500'
    default:
      return 'bg-white hover:bg-slate-50 border-slate-200'
  }
}

export function getBarColor(status: string) {
  switch (status) {
    case 'fail':
      return 'bg-rose-500'
    case 'warn':
      return 'bg-yellow-400'
    case 'active':
      return 'bg-blue-400'
    default:
      return 'bg-emerald-500'
  }
}
