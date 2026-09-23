# Configuración de Firebase

La integración está preparada pero no reemplaza todavía la PoC local.

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

## Siguiente etapa

Con la conexión verificada se reemplazarán, por separado:

1. Login local por Firebase Authentication.
2. `registro.json` y `localStorage` por la colección privada `registros`.
3. Estado local de campaña por el documento `config/app`.

Hasta entonces, la app continúa usando el flujo local actual.
