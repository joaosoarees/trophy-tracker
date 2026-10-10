# The onboarding form

How the multi-step form of the setup is built. The rules that follow from this are in `CLAUDE.md`; read this before changing anything under `ui/screens/Onboarding/`.

The onboarding (`ui/screens/Onboarding/`) is a single multi-step form with three steps: Language, Account, Done. Opened from Settings to add an account, it leaves the language step out.

```
Onboarding/
  index.tsx                  FormProvider + Stepper with the steps
  useOnboardingController.ts useForm, the watch subscription, the submit
  schema.ts                  onboardingSchema: one schema per step, and OnboardingFormData
  components/                Stepper/ (index, stepperState, useStepper), StepHeader, FieldError,
                             ControlledLanguageSelect, HelpList
  steps/<Name>Step/          index.tsx + schema.ts (+ use<Name>StepController.ts when it has state)
```

- The controller owns the form: `useForm` with `zodResolver(onboardingSchema)`. `DoneStep` has no schema: it is the summary and the way into the app, and decides nothing.
- Each step reads the form with `useFormContext<OnboardingFormData>()` and only advances after validating its own fields.
- **Stepper.** `stepperState.ts` is a pure, tested reducer holding the current step and the furthest one reached. It is local to the component on purpose (React's `useReducer`, not a store slice): the state is born and dies with the onboarding, and the `Stepper` stays a self-contained component. Do not move it to Zustand for uniformity. The step names at the top are buttons: any step already reached can be revisited in either direction, steps ahead stay locked. A step that changes something later steps depend on calls `lockFollowingSteps()` (through `useStepper`) so they must be reached again. Changing the language locks nothing.
- **The account step checks the SteamID and the key together.** A Web API key does not say whose it is, so the SteamID is still an input: detected from the Steam client and shown locked, with "Use another account" as the way out; a SteamID the user typed is never locked, and an account the app already has is not offered again. One "Verify" calls `checkApiKey` (key + SteamID against the official API, which returns name and avatar) and then `checkPrivacy`. There is no lookup of the public community profile any more: it was rate-limited and unreliable.
- **A verified account leaves the form.** When both checks pass the account is saved (`addAccount`) and shown as a card above the form, which is emptied; the step moves on only with at least one account, and removing the last one locks the following steps. The form of the first account is verified by the step's forward button; one opened with "Add another account" sits in a panel with its own "Verify" and "Cancel".
- Errors from Steam about the pair (rejected key, unknown SteamID, private profile) are shown in the step, not under one field, because they are not about one field. Format errors stay under their field.
- Schemas hold the message **key** (`'steamIdFormat'`), not the text; `FieldError` translates it when rendering, so the error follows a language change. Every key used in a schema must exist under `validation` in the locales (there is a test for it).
- A field that is not a plain `<input>` becomes a controlled component with `useController` (e.g. `ControlledLanguageSelect`).
- Field side effects use the `form.watch` subscription (e.g. switching the screen language), always with `unsubscribe` on cleanup.
- Nothing typed in the form is kept anywhere but the form: the language is saved as it is picked, an account as it is verified, and **the Web API key only lives in its field**.
- Enter in a field does not submit the whole form: the step treats Enter as its own "advance".
