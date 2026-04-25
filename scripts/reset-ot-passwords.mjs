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
    newPassword: 'Rmsic#Raul2026!',
  },
  {
    email: 'dallendes@rmsic.cl',
    newPassword: 'Rmsic#David2026!',
  },
]

async function getUserByEmail(email) {
  const { data, error } = await supabase.auth.admin.listUsers()

  if (error) {
    throw new Error(`No se pudo listar usuarios: ${error.message}`)
  }

  const user = data.users.find(
    (item) => (item.email || '').toLowerCase() === email.toLowerCase()
  )

  if (!user) {
    throw new Error(`No se encontró el usuario ${email}`)
  }

  return user
}

async function updatePassword(email, newPassword) {
  const user = await getUserByEmail(email)

  const { error } = await supabase.auth.admin.updateUserById(user.id, {
    password: newPassword,
    email_confirm: true,
  })

  if (error) {
    throw new Error(`No se pudo actualizar ${email}: ${error.message}`)
  }

  console.log(`[OK] Contraseña actualizada: ${email}`)
}

async function main() {
  for (const item of users) {
    await updatePassword(item.email, item.newPassword)
  }

  console.log('\nListo. Ya puedes probar login con las nuevas contraseñas.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})