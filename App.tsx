// luna ai - unfiltered ai companion app

import { Buffer } from 'buffer'
global.Buffer = Buffer

import { SafeAreaProvider } from 'react-native-safe-area-context'
import { ChatScreen } from './src/screens/ChatScreen'

export default function App() {
  return (
    <SafeAreaProvider>
      <ChatScreen />
    </SafeAreaProvider>
  )
}
