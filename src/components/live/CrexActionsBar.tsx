/**
 * CREX-Style Actions Bar
 * Admin actions for adding/editing balls
 */

import React from 'react'
import { useNavigate } from 'react-router-dom'

interface CrexActionsBarProps {
  matchId: string
}

export default function CrexActionsBar({ matchId }: CrexActionsBarProps) {
  const navigate = useNavigate()

  // TODO: Check if user is admin

  return (
    <div className="bg-white rounded-xl shadow-md p-4 border border-crex-gray-200">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-crex-gray-700">Admin Actions</div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate(`/admin?matchId=${matchId}`)}
            className="px-4 py-2 bg-crex-teal text-white rounded-lg hover:bg-crex-teal-dark transition-colors text-sm font-medium"
          >
            Add Ball
          </button>
          <button
            onClick={() => navigate(`/admin?matchId=${matchId}&action=edit`)}
            className="px-4 py-2 bg-crex-sky text-white rounded-lg hover:bg-crex-sky/80 transition-colors text-sm font-medium"
          >
            Edit Last
          </button>
          <button
            onClick={() => navigate(`/admin?matchId=${matchId}&action=undo`)}
            className="px-4 py-2 bg-crex-gray-600 text-white rounded-lg hover:bg-crex-gray-700 transition-colors text-sm font-medium"
          >
            Undo
          </button>
        </div>
      </div>
    </div>
  )
}

