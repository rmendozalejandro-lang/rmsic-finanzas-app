type EmpresaOption = {
  id: string
  nombre: string
}

type AurenHeaderProps = {
  empresaActivaId: string
  empresaActivaNombre: string
  empresas: EmpresaOption[]
  usuarioNombre: string
  usuarioRol: string
  onEmpresaChange: (empresaId: string) => void | Promise<void>
  onLogout: () => void | Promise<void>
}