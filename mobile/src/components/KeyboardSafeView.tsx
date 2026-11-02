import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Dimensions, Keyboard, Platform, View, type StyleProp, type ViewStyle } from 'react-native';

/**
 * Keeps its content above the on-screen keyboard.
 *
 * Android apps are edge-to-edge now, so the window no longer shrinks when the keyboard
 * opens, and KeyboardAvoidingView's offset depends on header/tab-bar sizes we can't
 * read reliably. Instead we measure where this view ends on screen and pad by exactly
 * the part the keyboard covers (so a tab bar under the screen is accounted for).
 */
export function KeyboardSafeView({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const ref = useRef<ComponentRef<typeof View>>(null);
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const show = Keyboard.addListener(showEvent, (e) => {
      const keyboardTop = e.endCoordinates.screenY || Dimensions.get('window').height - e.endCoordinates.height;
      ref.current?.measureInWindow((_x, y, _w, height) => {
        setInset(Math.max(0, y + height - keyboardTop));
      });
    });
    const hide = Keyboard.addListener(hideEvent, () => setInset(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return (
    <View ref={ref} style={[{ flex: 1 }, style]}>
      <View style={{ flex: 1, paddingBottom: inset }}>{children}</View>
    </View>
  );
}
