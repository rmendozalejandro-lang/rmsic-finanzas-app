import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
})

const users = [
  {
    email: 'rmendoza@rmsic.cl',
    password: 'Temporal#Raul2026',
    nombre: 'Raúl Mendoza C.',
    cargo: 'Ingeniero de Proyecto',
  },
  {
    email: 'dallendes@rmsic.cl',
    password: 'Temporal#David2026',
    nombre: 'David Allendes A.',
    cargo: 'Ingeniero Eléctrico',
  },
]

async function ensureUser(user) {
  const { data, error } = await supabase.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
    user_metadata: {
      nombre_completo: user.nombre,
      cargo: user.cargo,
    },
  })

  if (error) {
    if (
      error.message?.toLowerCase().includes('already registered') ||
      error.message?.toLowerCase().includes('already exists')
    ) {
      console.log(`[INFO] Usuario ya existe: ${user.email}`)
      return null
    }

    throw new Error(`Error creando ${user.email}: ${error.message}`)
  }

  console.log(`[OK] Usuario creado: ${user.email} -> ${data.user?.id}`)
  return data.user
}

async function main() {
  for (const user of users) {
    await ensureUser(user)
  }

  console.log('\nListo. Ahora prueba login con esos correos y claves temporales.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})