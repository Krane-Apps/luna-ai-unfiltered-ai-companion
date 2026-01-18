// chat bubble component for displaying messages

import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'

interface ChatBubbleProps {
  message: string
  isBot: boolean
  onPlayAudio?: () => void
  hasAudio?: boolean
}

export const ChatBubble = ({
  message,
  isBot,
  onPlayAudio,
  hasAudio
}: ChatBubbleProps) => {
  return (
    <View style={[styles.container, isBot ? styles.botContainer : styles.userContainer]}>
      <View style={[styles.bubble, isBot ? styles.botBubble : styles.userBubble]}>
        <Text style={[styles.text, isBot ? styles.botText : styles.userText]}>
          {message}
        </Text>
        {isBot && hasAudio && onPlayAudio && (
          <TouchableOpacity onPress={onPlayAudio} style={styles.audioButton}>
            <Text style={styles.audioIcon}>🔊</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text style={[styles.label, isBot ? styles.botLabel : styles.userLabel]}>
        {isBot ? 'Luna' : 'You'}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    maxWidth: '85%'
  },
  botContainer: {
    alignSelf: 'flex-start'
  },
  userContainer: {
    alignSelf: 'flex-end'
  },
  bubble: {
    padding: 14,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center'
  },
  botBubble: {
    backgroundColor: '#1e1e2e',
    borderBottomLeftRadius: 4
  },
  userBubble: {
    backgroundColor: '#ff69b4',
    borderBottomRightRadius: 4
  },
  text: {
    fontSize: 16,
    lineHeight: 22,
    flex: 1
  },
  botText: {
    color: '#fff'
  },
  userText: {
    color: '#fff'
  },
  label: {
    fontSize: 11,
    marginTop: 4,
    opacity: 0.6
  },
  botLabel: {
    color: '#ff69b4',
    marginLeft: 4
  },
  userLabel: {
    color: '#888',
    marginRight: 4,
    textAlign: 'right'
  },
  audioButton: {
    marginLeft: 8,
    padding: 4
  },
  audioIcon: {
    fontSize: 16
  }
})
