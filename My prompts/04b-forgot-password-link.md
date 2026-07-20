Read AGENTS.md first and follow it strictly.

## Task

On the Sign In screen, the "Forgot password?" link is currently non-functional. Because this app uses admin-managed accounts (staff cannot reset their own credentials — an Admin does it in the Clerk dashboard), replace that link with honest, non-interactive helper text instead of a broken link.

- Replace the "Forgot password?" text link with plain, non-tappable helper text reading: `"Forgot your password? Contact your administrator."`
- Keep it in the same position and the same secondary text color/size it currently uses, so the layout does not shift.
- Remove any `onPress`/`TouchableOpacity`/link behavior attached to the old element — this is static text now, not a pressable link.

## Constraints

- This is a copy-and-styling change only. Do not add any password-reset logic, screen, or Clerk flow.
- Do not change any other part of the Sign In screen.
- Follow the existing NativeWind styling patterns already used on that screen.
- Run `npm run lint` and `npm run typecheck` before finishing. Fix all errors.

## Reference

The Sign In screen was built in prompt 03 and wired to Clerk in prompt 04. This only touches the single "Forgot password?" element on that screen.
