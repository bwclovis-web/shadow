import FormField from "~/components/Atoms/FormField/FormField"
import Input from "~/components/Atoms/Input/Input"
import Select from "~/components/Atoms/Select/Select"
import { houseTypes } from "~/data/SelectTypes"
const InfoFieldset = ({ data, actions, hideImage = false }) => (
  <fieldset className="flex flex-col gap-2">
    <legend className="text-3xl text-noir-gold-100 font-bold mb-2">Info</legend>
    <FormField label="Name" error={actions.name?.errors?.[0]} required>
      <Input
        shading={true}
        inputType="text"
        action={actions.name}
        inputId="name"
        defaultValue={data?.name}
      />
    </FormField>
    <FormField label="Description" error={actions.description?.errors?.[0]}>
      <Input
        shading={true}
        inputType="text"
        action={actions.description}
        inputId="description"
        defaultValue={data?.description}
      />
    </FormField>
    <div className="grid grid-cols-2 gap-2">
      <FormField label="Founded" error={actions.founded?.errors?.[0]}>
        <Input
          shading={true}
          inputType="text"
          action={actions.founded}
          inputId="founded"
          defaultValue={data?.founded}
        />
      </FormField>
      <FormField label="House Type" error={actions.type?.errors?.[0]}>
        <Select
          ariaLabel="House Type"
          selectId="type"
          selectData={houseTypes}
          defaultId={data?.type}
        />
      </FormField>
    </div>
    {!hideImage && (
      <FormField label="Image URL" error={actions.image?.errors?.[0]}>
        <Input
          shading={true}
          inputType="text"
          action={actions.image}
          inputId="image"
          defaultValue={data?.image}
        />
      </FormField>
    )}
  </fieldset>
)

export default InfoFieldset
