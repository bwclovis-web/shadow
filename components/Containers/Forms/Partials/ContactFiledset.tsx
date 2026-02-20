import type { FC, RefObject } from "react"

import FormField from "~/components/Atoms/FormField/FormField"
import Input from "~/components/Atoms/Input/Input"

interface ContactFieldsetProps {
  inputRef: RefObject<HTMLInputElement | null>
  data?: {
    phone: string
    email: string
    website: string
  }
  actions: {
    phone: any
    email: any
    website: any
  }
}
const ContactFieldset: FC<ContactFieldsetProps> = ({ inputRef, data, actions }) => (
  <fieldset className="grid  grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 ">
    <legend className="text-3xl text-noir-gold-100 font-bold mb-2">Contact</legend>
    <FormField label="Phone" error={actions.phone?.errors?.[0]}>
      <Input
        shading={true}
        inputType="text"
        inputRef={inputRef}
        action={actions.phone}
        inputId="phone"
        defaultValue={data?.phone}
      />
    </FormField>
    <FormField label="Email" error={actions.email?.errors?.[0]}>
      <Input
        shading={true}
        inputType="text"
        inputRef={inputRef}
        action={actions.email}
        inputId="email"
        defaultValue={data?.email}
      />
    </FormField>
    <FormField label="Website" error={actions.website?.errors?.[0]}>
      <Input
        shading={true}
        inputType="text"
        inputRef={inputRef}
        action={actions.website}
        inputId="website"
        defaultValue={data?.website}
      />
    </FormField>
  </fieldset>
)

export default ContactFieldset
