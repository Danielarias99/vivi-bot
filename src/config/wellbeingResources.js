/**
 * Configuración de Recursos de Bienestar
 * 
 * Este archivo contiene la configuración de todos los recursos multimedia
 * disponibles en la opción 4 del menú (Recursos de bienestar).
 * 
 * INSTRUCCIONES PARA AGREGAR URLs DE AMAZON S3:
 * 1. Sube tus archivos multimedia a tu bucket de S3
 * 2. Configura los permisos públicos o genera URLs presignadas
 * 3. Inserta la URL completa (https://) en el campo 'url' de cada recurso
 * 4. Formato de URL esperado: https://bucket-name.s3.amazonaws.com/file-name.ext
 * 
 * TIPOS DE RECURSOS SOPORTADOS:
 * - audio: Archivos de audio (.aac, .mp3, etc.)
 * - video: Archivos de video (.mp4, etc.)
 * - image: Imágenes (.png, .jpg, etc.)
 * - document: Documentos PDF
 */

const resources = [
  {
    id: 'recurso_audio_relajacion',
    title: 'Audio: Relajación guiada',
    description: 'Audio corto para reducir el estrés (3-5 min).',
    type: 'audio',
    url: '' // TODO: INSERTAR AQUÍ LA URL DE S3 (ej: https://vivi-bot-uni.s3.amazonaws.com/audio-relajacion.aac)
  },
  {
    id: 'recurso_video_estiramiento',
    title: 'Video: Pausa activa y estiramientos',
    description: 'Rutina breve para realizar pausas en el estudio o trabajo.',
    type: 'video',
    url: '' // TODO: INSERTAR AQUÍ LA URL DE S3 (ej: https://vivi-bot-uni.s3.amazonaws.com/video-estiramiento.mp4)
  },
  {
    id: 'recurso_imagen_infografia',
    title: 'Infografía: Técnicas de respiración',
    description: 'Imagen con pasos para respiración 4-7-8.',
    type: 'image',
    url: '' // TODO: INSERTAR AQUÍ LA URL DE S3 (ej: https://vivi-bot-uni.s3.amazonaws.com/infografia-respiracion.png)
  },
  {
    id: 'recurso_documento_guia',
    title: 'Guía: Recursos y servicios',
    description: 'Documento PDF con información de contactos y servicios.',
    type: 'document',
    url: 'https://vivi-bot-uni.s3.amazonaws.com/Recursos_Bienestar_Univalle.pdf'
    // ✅ Este recurso ya tiene URL configurada
  }
];

export default resources;
