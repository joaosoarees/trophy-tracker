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
- **A submit that asks the main process runs once at a time, and always gives its button back.** The button is disabled by a pending flag in state, but Enter held down in a field asks again before that is drawn: the handler goes through `singleFlight` (`app/lib/singleFlight.ts`, kept with `useState(singleFlight)`), which drops a call made while the previous one runs. The flag is cleared in a `finally`, so a call that fails does not leave the button disabled. `useAccountStepController` ("Verify") and `useAccountDetailsController` ("Verify and save") are the models.
- **A call that fails is said where a refusal is.** What Steam refuses comes back as an answer (`CheckResult`) with its own words; the call to the main process can still reject (a write the disk refuses, the call itself failing). The submit catches that and puts `explainFailedCall(error, t)` (`app/lib/failedCall.ts`) on the form's own problem line: it writes the error to the log, as one nobody caught would be, and answers `errors.unexpected`. A button with no line of its own ("Check again" on an account) asks through a store action that shows the same text in a toast (`settings.recheckAccount`).
- **While a submit is in flight, nothing changes the list it answers for.** In the account step the X of an account card is disabled while an account is being verified or the setup is ending, as "Back" is: removing the last account mid-verify put the form back to its beginning, emptied, under a check that went on with what had been typed, and a refusal was then shown over a form that no longer held what was refused.
- **A step is not left while it waits for an answer.** Every call of a step that waits on the main process (an account being verified or removed, the setup ending) is passed to `whileBusy`, from `useStepper`. The `Stepper` counts it as it starts and as it ends, in a `finally`, and its reducer takes no move while one runs: not from a step name, not from "Back" or the forward button, not from the keyboard. The step names, `StepperPreviousButton` and `StepperNextButton` are disabled meanwhile by themselves; a step disables only what is its own (the X of a card, its "Verify"). Left mid-verify, the account step was gone when Steam refused the account: the form came back as typed with no reason, and a second verify could run beside the first. A step never tells the stepper "busy" and "done" itself, in an effect or otherwise: a step that failed or was unmounted in between would leave the stepper locked.
- **No step submits the form.** Each step's forward button is a plain button that asks for what the step does, and the account step's ends the setup through `whileBusy` (`onFinish`), so the `<form>` only refuses a submit.
- A form adds `schema.ts` to its folder.

## How the form is built

The onboarding (`ui/screens/Onboarding/`) is a single form in two steps: Language, then Account. Opened from Settings to add an account, it is the account step alone: the language step is left out and the bar of steps is not drawn.

```
Onboarding/
  index.tsx                  FormProvider + Stepper with the steps
  useOnboardingController.ts useForm, the watch subscription, the end of the setup
  schema.ts                  onboardingSchema: one schema per step, and OnboardingFormData
  components/                Stepper/ (index, StepperContext, stepperState, useStepper), StepHeader,
                             FieldError,
                             ControlledLanguageSelect, HelpList
  steps/<Name>Step/          index.tsx + schema.ts (+ use<Name>StepController.ts when it has state)
```

- The form is built with `useForm` and `zodResolver(onboardingSchema)`. There is no step for a summary: the account step lists what was verified and its forward button enters the app.
- A step reads the form typed: `useFormContext<OnboardingFormData>()`.
- **Stepper.** `stepperState.ts` is a pure, tested reducer holding the current step, the furthest one reached and how many steps there are, counted when the `Stepper` is mounted: a `Stepper` whose number of steps must change is mounted again (a `key`). `StepperContext.ts` holds the context, `null` outside a `Stepper`, and `useStepper` throws there. It is local to the component on purpose (React's `useReducer`, not a store slice): the state is born and dies with the onboarding, and the `Stepper` stays a self-contained component. The step names at the top are buttons: any step already reached can be revisited in either direction, steps ahead stay locked. A step that changes something later steps depend on calls `lockFollowingSteps()` (through `useStepper`) so they must be reached again. Changing the language locks nothing. The reducer also counts the tasks the current step is waiting on (`taskStarted`, `taskEnded`, dispatched by `whileBusy`) and refuses every move while there is one; locking the following steps is not a move and is still taken. **Two contexts:** `StepperContext` holds the four functions a step can call (`previousStep`, `nextStep`, `lockFollowingSteps`, `whileBusy`), the same ones for as long as the `Stepper` lives, so a step that reads them is never redrawn by the stepper; `StepperBusyContext` holds whether the step is busy and is read only by the stepper's two buttons. Do not put the current step, the furthest one or the busy flag into the first.
- **The account step checks the SteamID and the key together.** A Web API key does not say whose it is, so the SteamID is still an input: detected from the Steam client and shown locked, with "Use another account" as the way out; a SteamID the user typed is never locked, and an account the app already has is not offered again. One "Verify" calls `checkApiKey` (key + SteamID against the official API, which returns name and avatar) and then `checkPrivacy`. There is no lookup of the public community profile any more: it was rate-limited and unreliable.
- **The states of the account form are one reducer.** `steps/AccountStep/accountFormState.ts` is pure and tested, as `stepperState.ts` is: whether the form is open, whether it can be closed again (opened with "Add another account"), and what is known of the account signed in to the Steam client (`pending`, `none`, `inField` when it is in the field and locked, `setAside` when one was found but the field is the user's). They change together, so the controller only says what happened (`opened`, `closed`, `lastAccountRemoved`, `detected`, `steamIdEdited`). The Steam client is asked while the form is open and not answered (`isDetecting`): each time the form opens, not when the list changes under it. "I could not find an account" is shown only for `none`, never after "Use another account". Removing the last account puts the step back to its beginning: the required form, emptied, with the Steam client asked again.
- **A verified account leaves the form.** When both checks pass the account is saved (`addAccount`) and shown as a card above the form, which is emptied. Saving checks the pair once more and answers a `CheckResult`, like the two checks before it: when Steam answers otherwise this time, or the account was saved meanwhile, the form stays open with what was typed and shows the reason, and nothing is handed to `onChange`. The step moves on only with at least one account, and removing the last one locks the following steps. The form of the first account is verified by the step's forward button; one opened with "Add another account" sits in a panel with its own "Verify" and "Cancel".
- Errors from Steam about the pair (rejected key, unknown SteamID, private profile) are shown in the step, not under one field, because they are not about one field. Format errors stay under their field.
- A message key in a schema looks like `'steamIdFormat'`; `FieldError` translates it when rendering.
- A field that is not a plain `<input>` becomes a controlled component with `useController` (e.g. `ControlledLanguageSelect`).
- Field side effects use the `form.watch` subscription (e.g. switching the screen language), always with `unsubscribe` on cleanup.
- Nothing typed in the form is kept anywhere but the form: the language is saved as it is picked, an account as it is verified.
