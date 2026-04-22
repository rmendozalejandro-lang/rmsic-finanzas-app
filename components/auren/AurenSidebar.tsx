type SidebarItem = {
  href: string
  label: string
  moduleKey: string
}

type AurenSidebarProps = {
  items: SidebarItem[]
  pathname: string
  onNavigate: (href: string) => void
}