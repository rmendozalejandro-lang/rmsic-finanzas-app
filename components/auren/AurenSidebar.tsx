type SidebarItem = {
  href: string
  label: string
  moduleKey: string
}

type TralixiaSidebarProps = {
  items: SidebarItem[]
  pathname: string
  onNavigate: (href: string) => void
}