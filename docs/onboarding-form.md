# The onboarding form

The rules below are binding; `CLAUDE.md` sends you here before you change anything under `ui/screens/Onboarding/`, or add a form anywhere else.

## Rules

Forms are react-hook-form + zod. The setup (`ui/screens/Onboarding/`) is one form in two steps: Language, then Account.

- The controller owns the form (`useForm` with `zodResolver`). Each step reads it with `useFormContext` and advances only after validating its own fields.
- Schemas hold the message **key**, not the text, so an error follows a language change. Every key used in a schema exists under `validation` in the locales (a test checks it).
- The account step ends the setup (see `docs/accounts.md`). A step that asks nothing and decides nothing is not a step: do not add a summary.
- **The Web API key lives only in its field while it is typed.** It is not kept in `sessionStorage` or anywhere else, and a saved key is never put back on screen.
- The `Stepper`'s state is local to the component (`useReducer`), on purpose: do not move it to the store.
- Enter in a field is that step's own "advance", never the submit of the whole form.
- A form adds `schema.ts` to its folder.

## How the form is built

The onboarding (`ui/screens/Onboarding/`) is a single form in two steps: Language, then Account. Opened from Settings to add an account, it is the account step alone: the language step is left out and the bar of steps is not drawn.

```
Onboarding/
  index.tsx                  FormProvider + Stepper with the steps
  useOnboardingController.ts useForm, the watch subscription, the submit
  schema.ts                  onboardingSchema: one schema per step, and OnboardingFormData
  components/                Stepper/ (index, stepperState, useStepper), StepHeader, FieldError,
                             ControlledLanguageSelect, HelpList
  steps/<Name>Step/          index.tsx + schema.ts (+ use<Name>StepController.ts when it has state)
```

- The form is built with `useForm` and `zodResolver(onboardingSchema)`. There is no step for a summary: the account step lists what was verified and its forward button enters the app.
- A step reads the form typed: `useFormContext<OnboardingFormData>()`.
- **Stepper.** `stepperState.ts` is a pure, tested reducer holding the current step and the furthest one reached. It is local to the component on purpose (React's `useReducer`, not a store slice): the state is born and dies with the onboarding, and the `Stepper` stays a self-contained component. The step names at the top are buttons: any step already reached can be revisited in either direction, steps ahead stay locked. A step that changes something later steps depend on calls `lockFollowingSteps()` (through `useStepper`) so they must be reached again. Changing the language locks nothing.
- **The account step checks the SteamID and the key together.** A Web API key does not say whose it is, so the SteamID is still an input: detected from the Steam client and shown locked, with "Use another account" as the way out; a SteamID the user typed is never locked, and an account the app already has is not offered again. One "Verify" calls `checkApiKey` (key + SteamID against the official API, which returns name and avatar) and then `checkPrivacy`. There is no lookup of the public community profile any more: it was rate-limited and unreliable.
- **A verified account leaves the form.** When both checks pass the account is saved (`addAccount`) and shown as a card above the form, which is emptied; the step moves on only with at least one account, and removing the last one locks the following steps. The form of the first account is verified by the step's forward button; one opened with "Add another account" sits in a panel with its own "Verify" and "Cancel".
- Errors from Steam about the pair (rejected key, unknown SteamID, private profile) are shown in the step, not under one field, because they are not about one field. Format errors stay under their field.
- A message key in a schema looks like `'steamIdFormat'`; `FieldError` translates it when rendering.
- A field that is not a plain `<input>` becomes a controlled component with `useController` (e.g. `ControlledLanguageSelect`).
- Field side effects use the `form.watch` subscription (e.g. switching the screen language), always with `unsubscribe` on cleanup.
- Nothing typed in the form is kept anywhere but the form: the language is saved as it is picked, an account as it is verified.
