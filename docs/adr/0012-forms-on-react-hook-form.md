# A form's values, errors and submit belong to React Hook Form, checked through a Zod schema

A form in the Platform is a `useForm` from [React Hook Form](https://react-hook-form.com). The library holds what the fields contain, which of them are in error, whether a submit is under way, and where the focus goes after a refused one. The form's rules are a Zod schema (`zod/mini`, like every other schema in the repo) handed to `useForm` as its `resolver`, through `zodResolver` from `@hookform/resolvers`. A native input joins the form with `register`; a control that is not a native input, such as a picker, joins it with `Controller`.

Every form needs the same mechanics: nothing red before the first submit, each field checked again as it changes after it, the focus on the first field in error, a pending state while the request runs, and an error from the server beside the submit button. Written by hand they are a `tried` flag, a counter that exists to move the focus, a ref per field and an error state per form, repeated with small differences in each one. React Hook Form's defaults (`mode: 'onSubmit'`, `reValidateMode: 'onChange'`, `shouldFocusError`) are the behaviour `UsingComponents.mdx` asks of a form, so the form's file keeps only what is its own: its fields, its request and its words.

An error travels as a code, never as prose (ADR-0008). A schema reports an issue whose `message` is the key of the words in a dictionary, such as `passwordsDiffer`, and the component that draws the field looks the words up in the page's language. What a route refuses goes to the form with `setError('root.server', …)`, already worded by `routeErrorText`, and shows in the form's `StatusMessage`; the next submit clears it.

## Consequences

- `src/components/ui` does not import React Hook Form: a `Field`, an `Input` or a picker works in a form and outside one, and a story needs no form around it. The form that uses them does the wiring.
- A field's name in the form is its `name` in the DOM, since `register` finds the field by it. Password managers read that name, so a form of credentials keeps `email`, `password` and `confirm-password`.
- React Hook Form learns a field's value from its `change` and `blur` events. Some password managers fill a field with no event at all, so a form of credentials calls `adoptScreenValues` before it submits, which copies what the fields show into the form.
- After a refused submit React Hook Form focuses the first field in error, and does it again on the next timer tick. A test that fixes that field in the same instant sees the focus move to the next field in error; a person never types that fast.
- A field whose rule depends on another names it in `deps`, as the password does for its confirmation, so that changing one checks the other again.
- After a refused submit the focus goes to the first field in error in the order the fields joined the form, and a `Controller` joins after every `register` beside it. A text field that can be in error therefore uses `register`, even when it changes what is typed, as the Site address does to lowercase it.
- A component that edits several values at once, such as `SiteIconField`, reads them from `useWatch` and writes each with `setValue`.
- A text in every Language is a field per Language, named `texts.<language>`: `PerLanguageField` lays out and labels the controls, and each one is registered by its Language.
- A form in steps is one `useForm` whose submit is the forward button: `handleSubmit` checks the rules on every step and then moves on, sends, or goes back to the step that holds the field in error.
- React Hook Form does not empty a native field whose new value is `undefined`, so a form that starts over calls `reset` with an empty string for each field.
- A resolver that is not a schema, as where the values are mapped to Site settings before the parse, returns each error already worded by `errorText.ts` in the language the form passes as its `context`.
- A group of fields shared by several forms, such as `NewPasswordFields`, reads the form from `useFormContext`, and each form that uses it wraps its fields in a `FormProvider`.
- A form's behaviour is tested by rendering it in the `components` project (ADR-0011) and using it as a person does; its schema is tested on its own in `unit`.
