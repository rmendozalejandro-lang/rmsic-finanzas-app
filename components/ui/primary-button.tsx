import Link from 'next/link'
import type { ReactNode } from 'react'

type CommonProps = {
  children: ReactNode
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

type ButtonProps = CommonProps & {
  href?: never
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  onClick?: () => void
}

type LinkProps = CommonProps & {
  href: string
}

function getSizeClasses(size: 'sm' | 'md' | 'lg') {
  switch (size) {
    case 'sm':
      return 'px-4 py-2 text-sm'
    case 'lg':
      return 'px-5 py-3 text-sm'
    case 'md':
    default:
      return 'px-4 py-2.5 text-sm'
  }
}

function getBaseClasses(size: 'sm' | 'md' | 'lg', className?: string) {
  return [
    'inline-flex items-center justify-center rounded-xl font-semibold text-white transition-colors',
    'bg-[#163A5F] hover:bg-[#245C90]',
    'disabled:cursor-not-allowed disabled:opacity-70',
    getSizeClasses(size),
    className ?? '',
  ]
    .join(' ')
    .trim()
}

export function PrimaryButton({
  children,
  className,
  size = 'md',
  type = 'button',
  disabled,
  onClick,
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={getBaseClasses(size, className)}
    >
      {children}
    </button>
  )
}

export function PrimaryLink({
  href,
  children,
  className,
  size = 'md',
}: LinkProps) {
  return (
    <Link href={href} className={getBaseClasses(size, className)}>
      {children}
    </Link>
  )
}