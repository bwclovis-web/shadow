import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { PopOver } from './PopOver'

const attachHidePopoverMock = (panel: HTMLElement) => {
  const hidePopover = vi.fn()
  Object.assign(panel, { hidePopover })
  return hidePopover
}

/** Popover surfaces are not `:popover-open` in tests; include `hidden` so roles inside the panel resolve. */
const getPanel = () => screen.getByRole('dialog', { hidden: true })

const getPanelHeader = () => {
  const header = getPanel().querySelector('header')
  if (!header) {
    throw new Error('Expected PopOver panel to include a header element')
  }
  return header
}

const getPanelFooter = () => {
  const footer = getPanel().querySelector('footer')
  if (!footer) {
    throw new Error('Expected PopOver panel to include a footer element')
  }
  return footer
}

const defaultProps = {
  menuId: 'finder',
  header: { heading: 'Experiment Finder' },
  children: <p>Panel body</p>
}

describe('PopOver', () => {
  it('renders the trigger with visible label text', () => {
    render(
      <PopOver
        {...defaultProps}
        trigger={{ triggerText: 'Open', triggerVariant: 'secondary', triggerSize: 'xs' }}
      />
    )
    expect(screen.getByRole('button', { name: 'Open' })).toBeInTheDocument()
  })

  it('links the trigger to the popover surface via popoverTarget and toggle-popover command', () => {
    render(
      <PopOver
        {...defaultProps}
        menuId="menu-1"
        trigger={{ triggerText: 'Open menu', triggerVariant: 'secondary', triggerSize: 'xs' }}
      />
    )
    const trigger = screen.getByRole('button', { name: 'Open menu' })
    expect(trigger).toHaveAttribute('popovertarget', '--menu-menu-1')
    expect(trigger).toHaveAttribute('command', 'toggle-popover')
  })

  it('supports numeric menuId in element ids', () => {
    render(
      <PopOver
        menuId={99}
        header={{ heading: 'Titled' }}
        trigger={{ triggerText: 'Go', triggerVariant: 'secondary', triggerSize: 'xs' }}
      >
        <span>Inner</span>
      </PopOver>
    )
    const panel = getPanel()
    expect(panel).toHaveAttribute('id', '--menu-99')
    const title = screen.getByRole('heading', { level: 2, name: 'Titled', hidden: true })
    expect(title).toHaveAttribute('id', 'popover-panel-title-99')
    expect(panel).toHaveAttribute('aria-labelledby', 'popover-panel-title-99')
  })

  it('renders children inside the dialog', () => {
    render(<PopOver {...defaultProps} />)
    expect(within(getPanel()).getByText('Panel body')).toBeInTheDocument()
  })

  it('exposes the panel as a non-modal dialog with auto popover', () => {
    render(<PopOver {...defaultProps} />)
    const panel = getPanel()
    expect(panel).toHaveAttribute('popover', 'auto')
    expect(panel).toHaveAttribute('aria-modal', 'false')
  })

  it('uses aria-labelledby when a non-empty heading is provided', () => {
    render(<PopOver {...defaultProps} />)
    const panel = getPanel()
    expect(panel).toHaveAttribute('aria-labelledby', 'popover-panel-title-finder')
    expect(panel).not.toHaveAttribute('aria-label')
    expect(
      screen.getByRole('heading', { level: 2, name: 'Experiment Finder', hidden: true })
    ).toHaveAttribute('id', 'popover-panel-title-finder')
  })

  it('uses panelAriaLabel when there is no visible heading', () => {
    render(
      <PopOver menuId="plain" header={{ heading: '' }} panelAriaLabel="Filters">
        <div>Content</div>
      </PopOver>
    )
    const panel = getPanel()
    expect(panel).toHaveAttribute('aria-label', 'Filters')
    expect(panel).not.toHaveAttribute('aria-labelledby')
    expect(screen.queryByRole('heading', { hidden: true })).not.toBeInTheDocument()
  })

  it('defaults trigger accessible name to "Open menu" when trigger text is empty', () => {
    render(
      <PopOver
        menuId="a11y-default"
        header={{ heading: 'H' }}
        trigger={{ triggerText: '', triggerVariant: 'tertiary', triggerSize: 'md' }}
      >
        <div />
      </PopOver>
    )
    expect(screen.getByRole('button', { name: 'Open menu' })).toBeInTheDocument()
  })

  it('uses triggerAriaLabel when trigger text is empty', () => {
    render(
      <PopOver
        menuId="a11y-custom"
        header={{ heading: 'H' }}
        trigger={{
          triggerText: '',
          triggerAriaLabel: 'Open experiment list',
          triggerVariant: 'tertiary',
          triggerSize: 'md'
        }}
      >
        <div />
      </PopOver>
    )
    expect(screen.getByRole('button', { name: 'Open experiment list' })).toBeInTheDocument()
  })

  it('applies placement variant classes to the panel', () => {
    render(
      <PopOver {...defaultProps} placement="inlineEnd">
        <div />
      </PopOver>
    )
    expect(getPanel().className).toMatch(/card-menu-inline-end/)
  })

  it('calls hidePopover on the panel when the header close control is activated', () => {
    render(<PopOver {...defaultProps} />)
    const panel = getPanel()
    const hidePopover = attachHidePopoverMock(panel)

    fireEvent.click(within(getPanelHeader()).getByRole('button', { name: 'Close', hidden: true }))
    expect(hidePopover).toHaveBeenCalledTimes(1)
  })

  it('calls hidePopover when the footer cancel button is clicked', () => {
    render(<PopOver {...defaultProps} />)
    const panel = getPanel()
    const hidePopover = attachHidePopoverMock(panel)

    fireEvent.click(within(getPanelFooter()).getByText('Cancel'))
    expect(hidePopover).toHaveBeenCalledTimes(1)
  })

  it('renders footerAction from a render prop and closeMenu invokes hidePopover', () => {
    render(
      <PopOver
        {...defaultProps}
        footer={{
          footerAction: (closeMenu) => (
            <button type="button" onClick={closeMenu}>
              Apply
            </button>
          )
        }}
      />
    )
    const panel = getPanel()
    const hidePopover = attachHidePopoverMock(panel)

    fireEvent.click(screen.getByRole('button', { name: 'Apply', hidden: true }))
    expect(hidePopover).toHaveBeenCalledTimes(1)
  })

  it('omits the default dismiss button when closeButton is false', () => {
    render(
      <PopOver
        menuId="no-dismiss"
        header={{ heading: 'Only actions' }}
        footer={{
          closeButton: false,
          footerAction: <button type="button">OK</button>
        }}
      >
        <p>Msg</p>
      </PopOver>
    )
    expect(screen.queryByRole('button', { name: 'Cancel', hidden: true })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'OK', hidden: true })).toBeInTheDocument()
  })

  it('uses closeButtonLabel for the dismiss control', () => {
    render(
      <PopOver
        {...defaultProps}
        footer={{ closeButtonLabel: 'Dismiss' }}
      />
    )
    expect(within(getPanelFooter()).getByText('Dismiss')).toBeInTheDocument()
  })

  it('honors header.closeButtonAriaLabel on the close control', () => {
    render(
      <PopOver
        {...defaultProps}
        header={{ heading: 'T', closeButtonAriaLabel: 'Close panel' }}
      />
    )
    expect(screen.getByRole('button', { name: 'Close panel', hidden: true })).toBeInTheDocument()
  })
})
