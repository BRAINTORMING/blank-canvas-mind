# Mapa de Chile en Tiempo Real

## Plataforma Geoespacial Inteligente

Una aplicación web moderna para visualizar, analizar y gestionar información geográfica de Chile en tiempo real. Explora proyectos mineros, puertos, infraestructura energética y áreas protegidas a través de mapas interactivos 3D.

## 🌟 Características Principales

- **Mapa Interactivo de Chile**: Visualización completa desde Arica y Parinacota hasta Magallanes
- **Sistema de Capas**: Minería, puertos, energía, infraestructura y áreas protegidas
- **Búsqueda Inteligente**: Encuentra proyectos con filtros avanzados
- **Base de Datos Geoespacial**: PostGIS integrado para consultas espaciales
- **Actualizaciones en Tiempo Real**: Datos sincronizados con Lovable Cloud
- **Interfaz Moderna**: Diseño responsivo con Tailwind CSS

## 🛠️ Stack Tecnológico

- **Frontend**: React 18 + TypeScript + Vite
- **Mapas**: Leaflet.js + React-Leaflet
- **Backend**: Lovable Cloud (Supabase con PostGIS)
- **Estilos**: Tailwind CSS + shadcn/ui
- **Base de Datos**: PostgreSQL con extensión PostGIS

## 🚀 Comenzar

### Desarrollo Local

```sh
# Clonar el repositorio
git clone <YOUR_GIT_URL>

# Navegar al directorio
cd <YOUR_PROJECT_NAME>

# Instalar dependencias
npm i

# Iniciar servidor de desarrollo
npm run dev
```

### Ver en Lovable

Visita [tu proyecto en Lovable](https://lovable.dev/projects/d4a25d9e-def3-4ac3-a1ec-af473c0d61c1) para editar y publicar.

## 📊 Estructura de la Base de Datos

- **regiones**: 16 regiones de Chile con sus capitales
- **categorias**: Tipos de proyectos (minería, puertos, energía, etc.)
- **proyectos**: Información detallada con coordenadas geoespaciales
- **capas**: Sistema de capas personalizables para el mapa

## 🗺️ Próximas Características

- Exportación a KML/Google Earth
- Análisis de proximidad entre proyectos
- Rutas y mediciones en el mapa
- Filtros por radio de distancia
- Visualización 3D mejorada
- API de búsqueda con procesamiento de lenguaje natural

## 📱 Despliegue

Para publicar tu aplicación:
1. Abre [Lovable](https://lovable.dev/projects/d4a25d9e-def3-4ac3-a1ec-af473c0d61c1)
2. Haz clic en Share → Publish

## 🔗 Enlaces Útiles

- [Documentación de Lovable](https://docs.lovable.dev/)
- [Leaflet.js Docs](https://leafletjs.com/)
- [PostGIS Documentation](https://postgis.net/documentation/)

## 📄 Licencia

Este proyecto usa datos geográficos de Chile para fines educativos y de demostración.

---

**Hecho con ❤️ usando Lovable**
