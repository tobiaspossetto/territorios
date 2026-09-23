# Configuración de Firebase

Firebase es la fuente oficial del modo administrador. El mapa público consume
únicamente resúmenes agregados; el historial completo requiere autenticación.

## Consola de Firebase

1. Crear un proyecto de Firebase.
2. Registrar una aplicación web.
3. Crear una base de datos Cloud Firestore en modo producción.
4. En Authentication, habilitar el proveedor Correo electrónico/Contraseña.
5. En Authentication > Usuarios, crear el usuario administrador.
6. Copiar la configuración del SDK web a las variables `VITE_FIREBASE_*` de `.env`.

## Permiso administrador

Después del primer inicio de sesión, copiar el UID del usuario desde Authentication.
En Firestore crear:

- Colección: `admins`
- Documento: el UID exacto del usuario
- Campo booleano: `active = true`

Las reglas incluidas niegan por defecto todo acceso. Solo un usuario autenticado
con un documento activo en `admins` puede leer o modificar `registros` y `config`.

## Datos

- `registros`: historial privado editable por administradores.
- `territoriosPublicos`: resumen agregado que utiliza el mapa público.
- `config/public`: estado público del modo campaña.
- `admins`: permisos adicionales de administración.

El respaldo inicial permanece fuera de `public/` y nunca se copia al build.
