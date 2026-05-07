import { cva, VariantProps } from 'class-variance-authority'

export type PopOverVariants = VariantProps<typeof popOverVariants>

export const popOverVariants = cva(['max-w-max level-4 rounded-xl border border-border-light'], {
  compoundVariants: [{}],
  defaultVariants: {
    placement: 'above'
  },
  variants: {
    placement: {
      above: 'card-menu',
      below: 'card-menu-below',
      inlineStart: 'card-menu-inline-start',
      inlineEnd: 'card-menu-inline-end'
    },
    size: {
      lg: 'min-w-[800px] p-l',
      sm: 'min-w-[360px] p-s'
    }
  }
})

export const popOverHeaderSpacingVariants = cva(['border-b border-border-light'], {
  variants: {
    size: {
      lg: 'pb-l',
      sm: 'pb-s'
    }
  }
})

export const popOverContentSpacingVariants = cva([''], {
  variants: {
    size: {
      lg: 'py-l',
      sm: 'py-s'
    }
  }
})

export const popOverFooterSpacingVariants = cva(['pt-s border-t border-border-light'], {
  variants: {
    size: {
      lg: 'pt-l',
      sm: 'pt-s'
    }
  }
})
