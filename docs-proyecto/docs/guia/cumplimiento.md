# Guía de Cumplimiento Normativo y Privacidad desde el Diseño

**E.S.E. Hospital El Salvador de Ubaté**  
Marco normativo colombiano aplicable al Asistente Virtual asistido por Inteligencia Artificial.

---

## 1. Marco Legal Aplicable

| Norma | Aplicación Concreta al Asistente Virtual |
|-------|------------------------------------------|
| **Ley 1581 de 2012** (Habeas Data) | Exigencia de autorización previa, expresa e informada antes de iniciar la interacción. Definición del Hospital como Responsable y Google Cloud como Encargado del tratamiento. |
| **Decreto 1377 de 2013** (compilado en Decreto 1074 de 2015) | Reglas sobre el contenido del aviso de privacidad, medios de prueba de la autorización y políticas de tratamiento disponibles al titular. |
| **Datos Sensibles (Arts. 5 y 6, Ley 1581)** | Los datos sobre la salud tienen carácter sensible. El asistente NO solicita información de salud y advierte activamente al usuario que no debe suministrarla en el chat. |
| **Datos de Menores (Art. 7, Ley 1581)** | Si el paciente o consultante es menor de edad, el widget exige la manifestación expresa de actuar en calidad de padre, madre o representante legal. |
| **Transmisión Internacional (Art. 26, Ley 1581)** | Dado que los servidores de Google AI Studio procesan peticiones fuera de Colombia, se informa explícitamente al titular en el aviso legal y se exige la contratación de nivel de pago (Cloud Billing) para asegurar que Google no use los datos para reentrenar modelos. |
| **Res. 1995 de 1999 y Ley 2015 de 2020** | Confidencialidad y reserva de la historia clínica. El chatbot no tiene acceso de lectura ni escritura a la historia clínica. En el módulo acompañante solo se exponen datos expresamente autorizados por el paciente (`share_with_companion`, `share_diagnosis`). |
| **Ley 1273 de 2009** (Delitos Informáticos) | Justificación de controles de rate limiting, enmascaramiento de PII, hashing de IPs y almacenamiento seguro de credenciales solo en backend. |

---

## 2. Principios de Privacidad desde el Diseño

1. **Autorización Previa:** Ninguna conversación puede iniciarse sin que el usuario acepte de manera expresa e informada el consentimiento (bloqueo en frontend y respuesta `403 Forbidden` en backend).
2. **Minimización de Datos:** Ni el nombre, ni el número de documento, ni el teléfono, ni los datos clínicos viajan al servicio de IA.
3. **Finalidad Estrictamente Limitada:** El procesamiento se circunscribe a resolver inquietudes operativas sobre el pre-registro y consulta de acompañante.
4. **Transparencia Activa:** El usuario visualiza de forma permanente que está interactuando con un sistema de Inteligencia Artificial que puede cometer imprecisiones y que no constituye juicio médico.
5. **Responsabilidad Demostrada (Accountability):** Toda autorización y revocación se registra en la base de datos PostgreSQL (`consent_records`) con marca de tiempo UTC, versión del texto legal, identificador anónimo de sesión y hashes criptográficos de User-Agent e IP.

---

## 3. Procedimiento para el Ejercicio de Derechos (ARCO)

Los titulares de la información pueden ejercer sus derechos de conocer, actualizar, rectificar y suprimir sus datos en cualquier momento:

- **Canal Inmediato (Revocación):** El usuario puede hacer clic en "Revocar autorización" en el menú de opciones del widget, lo que marca el consentimiento como revocado en base de datos y deshabilita la conversación de inmediato.
- **Canal Institucional:** Mediante solicitud remitida al correo electrónico oficial: `protecciondatos@hospitalubate.gov.co`.

---

## 4. Checklist de Evaluación de Impacto en Privacidad (PIA/DPIA) para Paso a Producción

- [x] La clave `GEMINI_API_KEY` reside exclusivamente en variables de entorno del servidor.
- [x] Filtro de expresiones regulares para cédulas, celulares y correos antes de transmitir datos.
- [x] Detección de urgencias médicas que deriva de inmediato al 123 y a Urgencias presencial.
- [x] Modelo de datos de consentimientos con soporte de auditoría e inmutabilidad.
- [x] Textos legales versionados gestionados externamente mediante `consent-text.json`.
- [ ] Validación formal del texto legal por el asesor jurídico y el Oficial de Protección de Datos de la ESE.
- [ ] Confirmación de cuenta Google AI Studio / Google Cloud con contrato de transmisión de datos bajo facturación activa.
- [ ] Verificación de la inscripción y actualización del Registro Nacional de Bases de Datos (RNBD) ante la SIC.
