import type { FieldMetadata } from "@conform-to/react"
import type { FC, RefObject } from "react"

import FormField from "~/components/Atoms/FormField/FormField"
import Input from "~/components/Atoms/Input/Input"
import Select from "~/components/Atoms/Select/Select"
import countryData from "~/data/countryList.json"

interface AddressFieldsetProps {
  inputRef: RefObject<HTMLInputElement | null>
  address: FieldMetadata<unknown>
  country?: FieldMetadata<unknown>
  data?: {
    address: string
    country: string
  }
}
const AddressFieldset: FC<AddressFieldsetProps> = ({ inputRef, address, country, data }) => (
  <fieldset className="flex gap-2">
    <legend className="text-3xl text-noir-gold-100 font-bold mb-2">Address</legend>
    <div className="grid grid-cols-2 w-full gap-2">
      <FormField label="Address" error={address?.errors?.[0]}>
        <Input
          shading={true}
          inputType="text"
          inputRef={inputRef}
          action={address}
          inputId="address"
          defaultValue={data?.address}
        />
      </FormField>
      <FormField label="Country" error={country?.errors?.[0]}>
        <Select
          selectData={countryData}
          selectId="country"
          ariaLabel="Country"
          defaultId={data?.country}
        />
      </FormField>
    </div>
  </fieldset>
)

export default AddressFieldset
