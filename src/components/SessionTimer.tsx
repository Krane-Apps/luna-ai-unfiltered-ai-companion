// session timer component showing remaining time

import { useEffect, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { formatTimeRemaining, getTimeRemaining, getSessionState } from '../services/payment'

interface SessionTimerProps {
  onSessionExpired: () => void
}

export const SessionTimer = ({ onSessionExpired }: SessionTimerProps) => {
  const [timeLeft, setTimeLeft] = useState(formatTimeRemaining())
  const [isGrace, setIsGrace] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = getTimeRemaining()
      setTimeLeft(formatTimeRemaining())

      const session = getSessionState()
      setIsGrace(!session.transactionSignature && session.isActive)

      if (remaining <= 0) {
        onSessionExpired()
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [onSessionExpired])

  return (
    <View style={[styles.container, isGrace && styles.graceContainer]}>
      <Text style={styles.label}>
        {isGrace ? 'Grace Period' : 'Session'}
      </Text>
      <Text style={[styles.time, isGrace && styles.graceTime]}>
        {timeLeft}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 105, 180, 0.15)',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    gap: 8
  },
  graceContainer: {
    backgroundColor: 'rgba(74, 222, 128, 0.15)'
  },
  label: {
    fontSize: 12,
    color: '#888'
  },
  time: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ff69b4'
  },
  graceTime: {
    color: '#4ade80'
  }
})
