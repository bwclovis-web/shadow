import type { Meta, StoryObj } from '@storybook/react'

import { Button } from '../../Atoms/Button/Button'
import { PopOver } from './PopOver'

const popOverDocsDescription = `
Popover built on the native [\`popover\`](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API) API and CSS anchor positioning. The trigger is a \`Button\` with \`popoverTarget\`; the panel is a \`div\` with \`popover="auto"\`.

### Usage
- Give each instance a **stable unique \`menuId\`** (used for DOM ids and anchor names).
- **\`trigger\`** configures the trigger button (variant, size, text, optional icon). When **\`triggerText\`** is empty (icon-only trigger), set **\`trigger.triggerAriaLabel\`** for a localized name; if omitted, a generic \`Open menu\` label is applied so the control is never unnamed.
- **\`header\`** configures title, optional heading icon, close position, and optional **\`closeButtonAriaLabel\`** for the header dismiss control (defaults to \`Close\`).
- **\`footer\`** is optional: **\`footerAction\`** for a custom slot; **\`footer.closeButton\`** to style the footer dismiss control, or \`false\` to hide it. When \`closeButton\` is omitted, the footer dismiss defaults to \`secondary\` / \`xs\` with **no icon**; set \`footer.closeButton.icon\` to show one (for example \`x\`).
- **\`size\`** on the panel is **\`sm\`** (compact) or **\`lg\`** (wide) only.
- **Accessibility**: the panel uses **\`role="dialog"\`** with **\`aria-modal={false}\`**. With a visible **\`header.heading\`**, the dialog is named via **\`aria-labelledby\`** on that title; if you omit the heading, set **\`panelAriaLabel\`** so the surface still has an accessible name.
- **Keyboard**: Escape closes and returns focus to the trigger; Tab moves through controls inside the panel (inner buttons and links do not auto-close the popover).

### Browser support
The Popover API is required; unsupported browsers will not show anchored behavior.
`.trim()

const meta: Meta<typeof PopOver> = {
  args: {
    placement: 'below',
    size: 'sm'
  },
  argTypes: {
    placement: {
      control: 'select',
      description: 'Anchor placement for the panel.',
      options: ['above', 'below', 'inlineStart', 'inlineEnd']
    },
    size: {
      control: 'select',
      description: 'Panel width preset (`sm` compact, `lg` wide).',
      options: ['sm', 'lg']
    }
  },
  component: PopOver,
  parameters: {
    docs: {
      description: {
        component: popOverDocsDescription
      }
    },
    layout: 'padded'
  },
  tags: ['autodocs'],
  title: 'Organisms/PopOver'
}

export default meta

type Story = StoryObj<typeof meta>

const storyShellClass = 'flex min-h-72 items-start justify-center p-m'

export const Default: Story = {
  name: 'Default',
  render: (args) => (
    <div className={storyShellClass}>
      <PopOver
        header={{ heading: 'Options' }}
        menuId="popover-story-default"
        placement={args.placement}
        size={args.size}
        trigger={{
          triggerText: 'Open menu',
          triggerVariant: 'secondary',
          triggerSize: 'sm'
        }}
      >
        <p className="text-sm text-text-primary m-0">
          Choose an action from the footer or dismiss with the header or footer close controls.
        </p>
      </PopOver>
    </div>
  )
}

export const WithFooterAction: Story = {
  name: 'With footer action',
  args: {
    placement: 'inlineEnd'
  },
  render: (args) => (
    <div className={storyShellClass}>
      <PopOver
        footer={{
          closeButton: { variant: 'tertiary', size: 'xs', icon: 'x', ariaLabel: 'Close' },
          footerAction: (
            <Button icon="flag" size="xs" type="button" variant="tertiary">
              Flag
            </Button>
          )
        }}
        header={{ heading: 'Experiment finder' }}
        menuId="popover-story-footer-action"
        placement={args.placement}
        size={args.size}
        trigger={{
          triggerText: 'Open',
          triggerVariant: 'secondary',
          triggerSize: 'xs'
        }}
      >
        <p className="text-sm text-text-primary m-0">Footer shows a custom action next to the dismiss control.</p>
      </PopOver>
    </div>
  )
}

export const FooterDismissHidden: Story = {
  name: 'Footer dismiss hidden',
  render: (args) => (
    <div className={storyShellClass}>
      <PopOver
        footer={{ closeButton: false }}
        header={{ heading: 'Header close only' }}
        menuId="popover-story-no-footer-close"
        placement={args.placement}
        size={args.size}
        trigger={{
          triggerText: 'Open',
          triggerVariant: 'tertiary',
          triggerSize: 'sm'
        }}
      >
        <p className="text-sm text-text-primary m-0">
          The footer dismiss button is hidden; use the header close control.
        </p>
      </PopOver>
    </div>
  )
}

export const FooterDismissPrimary: Story = {
  name: 'Footer dismiss (primary)',
  render: (args) => (
    <div className={storyShellClass}>
      <PopOver
        footer={{
          closeButton: { variant: 'primary', size: 'sm', icon: 'x', ariaLabel: 'Close panel' }
        }}
        header={{ heading: 'Styled footer close' }}
        menuId="popover-story-footer-primary"
        placement={args.placement}
        size={args.size}
        trigger={{
          triggerText: 'Open',
          triggerVariant: 'secondary',
          triggerSize: 'sm'
        }}
      >
        <p className="text-sm text-text-primary m-0">Footer dismiss uses a primary button for emphasis.</p>
      </PopOver>
    </div>
  )
}

export const IconOnlyTrigger: Story = {
  name: 'Icon-only trigger',
  render: (args) => (
    <div className={storyShellClass}>
      <PopOver
        header={{ heading: 'Filters' }}
        menuId="popover-story-icon-only"
        placement={args.placement}
        size={args.size}
        trigger={{
          triggerAriaLabel: 'Open filters menu',
          triggerIcon: 'flag',
          triggerVariant: 'tertiary',
          triggerSize: 'sm'
        }}
      >
        <p className="text-sm text-text-primary m-0">Trigger has no visible text; use triggerAriaLabel for the accessible name.</p>
      </PopOver>
    </div>
  )
}

export const HeaderCloseOnLeft: Story = {
  name: 'Header close on left',
  render: (args) => (
    <div className={storyShellClass}>
      <PopOver
        header={{
          closePosition: 'left',
          heading: 'Close on the left'
        }}
        menuId="popover-story-close-left"
        placement={args.placement}
        size={args.size}
        trigger={{
          triggerText: 'Open',
          triggerVariant: 'secondary',
          triggerSize: 'sm'
        }}
      >
        <p className="text-sm text-text-primary m-0">
          Header close button is rendered before the title.
        </p>
      </PopOver>
    </div>
  )
}
