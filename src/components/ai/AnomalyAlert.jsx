/**
 * Anomaly Alert Component
 * 
 * Displays AI-detected scoring anomalies with severity levels.
 * Shows warnings before ball events are saved.
 * 
 * @component
 */

import { detectAnomaly } from '../../services/ai/aiAnomaly'

const AnomalyAlert = ({ 
  anomaly, 
  onDismiss, 
  onFix,
  show = true 
}) => {
  if (!show || !anomaly || !anomaly.isAnomaly) {
    return null
  }

  const getSeverityStyles = (severity) => {
    switch (severity) {
      case 'high':
        return {
          bg: 'bg-red-50 dark:bg-red-900/20',
          border: 'border-red-500',
          icon: '🔴',
          text: 'text-red-800 dark:text-red-200',
          button: 'bg-red-100 hover:bg-red-200 dark:bg-red-900 dark:hover:bg-red-800 text-red-700 dark:text-red-300',
        }
      case 'medium':
        return {
          bg: 'bg-yellow-50 dark:bg-yellow-900/20',
          border: 'border-yellow-500',
          icon: '⚠️',
          text: 'text-yellow-800 dark:text-yellow-200',
          button: 'bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-900 dark:hover:bg-yellow-800 text-yellow-700 dark:text-yellow-300',
        }
      case 'low':
        return {
          bg: 'bg-blue-50 dark:bg-blue-900/20',
          border: 'border-blue-500',
          icon: 'ℹ️',
          text: 'text-blue-800 dark:text-blue-200',
          button: 'bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-300',
        }
      default:
        return {
          bg: 'bg-gray-50 dark:bg-gray-700/50',
          border: 'border-gray-500',
          icon: 'ℹ️',
          text: 'text-gray-800 dark:text-gray-200',
          button: 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300',
        }
    }
  }

  const styles = getSeverityStyles(anomaly.severity)

  return (
    <div
      className={`anomaly-alert ${styles.bg} border-l-4 ${styles.border} rounded-lg p-4 mb-4 shadow-md animate-slide-in`}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <div className="text-2xl">{styles.icon}</div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <h4 className={`font-semibold ${styles.text}`}>
              {anomaly.severity === 'high' ? 'Critical Error' : 
               anomaly.severity === 'medium' ? 'Warning' : 
               'Notice'}
            </h4>
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                aria-label="Dismiss"
              >
                ✕
              </button>
            )}
          </div>
          
          <p className={`text-sm ${styles.text} mb-3`}>
            {anomaly.message}
          </p>

          {anomaly.suggestedFix && (
            <div className="mb-3">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Suggested Fix:
              </p>
              <p className="text-xs text-gray-700 dark:text-gray-300">
                {anomaly.suggestedFix}
              </p>
            </div>
          )}

          {anomaly.field && (
            <div className="mb-3">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Field: <span className="font-mono">{anomaly.field}</span>
              </span>
            </div>
          )}

          {onFix && (
            <button
              onClick={onFix}
              className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${styles.button}`}
            >
              Apply Fix
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default AnomalyAlert

