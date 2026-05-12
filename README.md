# SafeRoute Expo Template

Proyecto base con Expo y React Native.

## Requisitos

- Node.js 20.19 o superior
- npm 11 o superior
- Git

Para ejecutar la app en un equipo nuevo necesitas ademas una de estas opciones:

- Expo Go en un telefono fisico
- Android Studio con emulador Android
- Xcode si vas a correr iOS en macOS

## Clonar e instalar

```bash
git clone https://github.com/TU_USUARIO/saferoute_expo_template.git
cd saferoute_expo_template
npm install
```

## Ejecutar

```bash
npm start
```

Tambien puedes usar:

```bash
npm run android
npm run ios
npm run web
```

## Archivos que si se deben subir

- `App.tsx`
- `index.ts`
- `app.json`
- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `assets/`

## Archivos que no se deben subir

Ya estan cubiertos por `.gitignore`:

- `node_modules/`
- `.expo/`
- `android/` y `ios/` generados por Expo prebuild
- logs locales como `expo.stdout.log`

## Notas

- No subas rutas absolutas de tu computador. El proyecto debe funcionar solo con archivos relativos dentro del repositorio.
- Si en el futuro usas variables de entorno, sube un archivo `.env.example` con nombres de ejemplo y deja los valores reales fuera de Git.
- Si alguien clona el repo, lo correcto es que ejecute `npm install` y luego `npm start`. No debes subir `node_modules`.
