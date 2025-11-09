// Get Calendar ID from the screenshot
// The user needs to:
// 1. Go to Google Calendar settings for "Citas psicologa univalle"
// 2. Scroll down to "Integrate calendar"
// 3. Copy the "Calendar ID"
// 4. Add it as GOOGLE_CALENDAR_ID in Railway

console.log('📋 INSTRUCCIONES PARA OBTENER EL CALENDAR ID:');
console.log('');
console.log('1. Ve a Google Calendar: https://calendar.google.com/');
console.log('2. En el lado izquierdo, busca el calendario "Citas psicologa univalle"');
console.log('3. Haz clic en los 3 puntos (⋮) junto al calendario');
console.log('4. Selecciona "Settings and sharing"');
console.log('5. Baja hasta la sección "Integrate calendar"');
console.log('6. Copia el "Calendar ID" (se verá algo como: abc123@group.calendar.google.com)');
console.log('');
console.log('7. Ve a Railway.app → Tu proyecto → Variables');
console.log('8. Agrega una nueva variable:');
console.log('   Name: GOOGLE_CALENDAR_ID');
console.log('   Value: [pega el Calendar ID que copiaste]');
console.log('');
console.log('9. Railway se reiniciará automáticamente');
console.log('');
console.log('✅ Después de esto, el bot podrá crear eventos en ese calendario específico');

