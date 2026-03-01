import FormField from "@/components/Atoms/FormField/FormField"  
import Input from "@/components/Atoms/Input/Input"
import Select from "@/components/Atoms/Select/Select"
import { houseTypes } from "@/data/SelectTypes"
interface InfoFieldsetProps {
  data?: Record<string, unknown>
  actions?: Record<string, { errors?: string[]; name?: string; key?: string; id?: string; initialValue?: unknown }>
  hideImage?: boolean
}
const InfoFieldset = ({ data, actions = {}, hideImage = false }: InfoFieldsetProps) => (
  <fieldset className="flex flex-col gap-2">
    <legend className="text-3xl text-noir-gold-100 font-bold mb-2">Info</legend>
    <FormField label="Name" error={actions.name?.errors?.[0]} required>
      <Input
        shading={true}
        inputType="text"
        action={actions.name as import("@conform-to/react").FieldMetadata<string, Record<string, unknown>, unknown>}
        inputId="name"
        defaultValue={data?.name as string | undefined}
      />
    </FormField>
    <FormField label="Description" error={actions.description?.errors?.[0]}>
      <Input
        shading={true}
        inputType="text"
        action={actions.description as import("@conform-to/react").FieldMetadata<string, Record<string, unknown>, unknown>}
        inputId="description"
        defaultValue={data?.description as string | undefined}
      />
    </FormField>
    <div className="grid grid-cols-2 gap-2 w-full items-center">
      <FormField label="Founded" error={actions.founded?.errors?.[0]}>
        <Input
          shading={true}
          inputType="text"
          action={actions.founded as import("@conform-to/react").FieldMetadata<string, Record<string, unknown>, unknown>}
          inputId="founded"
          defaultValue={data?.founded as string | undefined}
        />
      </FormField>
      <FormField label="House Type" error={actions.type?.errors?.[0]}>
        <Select
          ariaLabel="House Type"
          selectId="type"
          selectData={houseTypes}
          defaultId={data?.type as string | number | undefined}
        />
      </FormField>
    </div>
    {!hideImage && (
      <FormField label="Image URL" error={actions.image?.errors?.[0]}>
        <Input
          shading={true}
          inputType="text"
          action={actions.image as import("@conform-to/react").FieldMetadata<string, Record<string, unknown>, unknown>}
          inputId="image"
          defaultValue={data?.image as string | undefined}
        />
      </FormField>
    )}
  </fieldset>
)

export default InfoFieldset
