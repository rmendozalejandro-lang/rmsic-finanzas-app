type EmpresaOption = {
  id: string
  nombre: string
}

type TralixiaHeaderProps = {
  empresaActivaId: string
  empresaActivaNombre: string
  empresas: EmpresaOption[]
  usuarioNombre: string
  usuarioRol: string
  onEmpresaChange: (empresaId: string) => void | Promise<void>
  onLogout: () => void | Promise<void>
}