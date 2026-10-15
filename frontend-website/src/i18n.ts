import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: { translation: {
    brand: 'Barangay Document Services', tagline: 'A clear path to the documents you need.',
    documentTitle: 'Barangay Document Services', documentDescription: 'Request and track barangay documents online.',
    navHome: 'Home', navDocuments: 'Documents', navTrack: 'Track a request', language: 'Filipino',
    eyebrow: 'Resident services', heroTitle: 'Request a barangay document, simply.', heroText: 'Browse available documents, send a request without creating an account, and check its progress when you have your reference and private tracking credential.',
    browse: 'Browse documents', track: 'Track a request', homeStep1: 'Choose a document', homeStep1Text: 'Review the requirements and information needed.', homeStep2: 'Send your request', homeStep2Text: 'Complete the form. No resident account is needed.', homeStep3: 'Save your details', homeStep3Text: 'Keep your reference and private tracking credential together.',
    browseTitle: 'Available documents', browseIntro: 'Document names and requirements are provided by the barangay.',
    loading: 'Loading information…', loadError: 'We could not load the document list.', retry: 'Try again', emptyCatalog: 'No documents are currently available. Please check again later.',
    requirements: 'What you will need', startRequest: 'Request this document', backDocuments: 'Back to documents', documentNotFound: 'This document is unavailable or no longer active.',
    description: 'About this document', requestTitle: 'Request', applicantDetails: 'Your details', fullName: 'Full name', contactNumber: 'Contact number', address: 'Home address', yourInformation: 'Information for this document',
    required: 'Required', optional: 'Optional', submit: 'Send request', submitting: 'Sending…', submitHelp: 'Your information is sent securely to the barangay request system.',
    formError: 'We could not submit your request. Your entries are still here. Please review them and try again.', serverValidation: 'Check this value and try again.',
    networkError: 'We could not reach the service. Check your connection and try again.', timeoutError: 'The service took too long to respond.', invalidResponse: 'The service returned an unreadable response.', validationError: 'Some information could not be accepted. Review the form and try again.', authenticationError: 'Authentication is required for this request.', forbiddenError: 'This action is not available. Refresh the page or contact the barangay.', requestNotFound: 'The requested information is no longer available.', conflictError: 'The request could not be completed because its information changed.', preconditionError: 'The page may be out of date. Refresh it and try again.', payloadTooLarge: 'The request is too large. Shorten the information and try again.', rateLimit: 'Too many attempts. Please wait {{seconds}} seconds and try again.', rateLimitGeneric: 'Too many attempts. Please wait a little and try again.', serverError: 'The service is temporarily unavailable. Please try again later.', apiError: 'The request could not be completed. Please try again.', supportRequestId: 'Reference for support: {{id}}.',
    submissionUncertainTitle: 'We could not confirm the result', submissionSending: 'Your request is still being sent. Please wait.', submissionUncertain: 'The request may have reached the barangay. Retry this exact request to safely check its result, or explicitly choose to start a new one.', submissionReplayExpired: 'The safe retry period has ended. The previous request may have been received; contact the barangay before sending another request.', submissionReloadWarning: 'This page was refreshed, so the original request cannot be replayed safely. The previous request may have been received.', retrySameSubmission: 'Retry the same request', startNewAfterUncertain: 'I understand; start a new request', confirmationUnavailable: 'This confirmation is available only in the active tab and expires after a short time. A refresh or direct visit cannot restore the private tracking credential.',
    confirmationTitle: 'Your request was submitted', confirmationText: 'Save both details below. You will need the reference and private tracking credential to check progress. Keep the tracking credential private.',
    reference: 'Request reference', trackingCredential: 'Private tracking credential', copy: 'Copy', copied: 'Copied', copyFailed: 'Could not copy. Please select and copy it manually.',
    nextTrack: 'Track this request', saveReminder: 'Keep these details somewhere safe, especially on a shared device. This tab keeps them only temporarily; they are not sent by email or text.',
    trackTitle: 'Track a request', trackText: 'Enter the reference and private tracking credential you received after submitting the request.',
    checkProgress: 'Check progress', checking: 'Checking…', trackError: 'We could not find a request with those details. Check both values and try again.',
    trackResult: 'Request progress', submittedOn: 'Submitted', expectedDate: 'Expected release date', expectedHelp: 'This is the expected date. It does not mean the document is ready for pickup.',
    readyAt: 'Ready for pickup', releasedAt: 'Released', noDate: 'Not set', status: 'Status', statusMessage: 'Update', progressPrivate: 'Only the request progress is shown here. Applicant details are not displayed.',
    status_SUBMITTED: 'Submitted', status_UNDER_REVIEW: 'Under review', status_PROCESSING: 'Processing', status_READY_FOR_PICKUP: 'Ready for pickup', status_RELEASED: 'Released', status_REJECTED: 'Not approved', status_CANCELLED: 'Cancelled',
    notReady: 'Not yet marked ready', notReleased: 'Not yet released', footer: 'Barangay document requests', footerNote: 'Use the contact details provided by your barangay for questions about a request.',
    homeLink: 'Return home', languageName: 'English', dynamicHelp: 'Enter the information requested below.', serverReference: 'If you contact the barangay, include your request reference. Do not share your tracking credential publicly.',
    nameMin: 'Enter at least 2 characters.', nameMax: 'Use 160 characters or fewer.', contactInvalid: 'Enter a valid contact number.', addressInvalid: 'Enter an address of at least 3 characters.',
    dynamicRequired: '{{label}} is required.', dynamicMax: '{{label}} must be 1,000 characters or fewer.', dynamicDate: 'Enter a valid date for {{label}}.', dynamicOption: 'Choose one of the listed options for {{label}}.',
    referenceInvalid: 'Enter a valid request reference.', credentialInvalid: 'Enter your private tracking credential.',
    skipToMain: 'Skip to main content', mainNavigation: 'Main navigation', switchLanguage: 'Change language',
    documentCount_one: '{{count}} document type available', documentCount_other: '{{count}} document types available',
  } },
  fil: { translation: {
    brand: 'Mga Dokumento ng Barangay', tagline: 'Maayos na paraan para makuha ang dokumentong kailangan mo.',
    documentTitle: 'Mga Dokumento ng Barangay', documentDescription: 'Humiling at sumubaybay ng mga dokumento ng barangay online.',
    navHome: 'Tahanan', navDocuments: 'Mga dokumento', navTrack: 'Subaybayan ang kahilingan', language: 'English',
    eyebrow: 'Serbisyo para sa residente', heroTitle: 'Humiling ng dokumento ng barangay nang madali.', heroText: 'Tingnan ang mga dokumentong maaaring hilingin, magsumite nang walang account, at alamin ang progreso gamit ang iyong reference at pribadong tracking credential.',
    browse: 'Tingnan ang mga dokumento', track: 'Subaybayan ang kahilingan', homeStep1: 'Pumili ng dokumento', homeStep1Text: 'Basahin ang mga kailangan at impormasyong hinihingi.', homeStep2: 'Ipadala ang kahilingan', homeStep2Text: 'Punan ang form. Hindi kailangan ng resident account.', homeStep3: 'Itago ang mga detalye', homeStep3Text: 'Pagsamahin at itago ang reference at pribadong tracking credential.',
    browseTitle: 'Mga dokumentong maaaring hilingin', browseIntro: 'Ang barangay ang nagbibigay ng mga pangalan at kinakailangan ng dokumento.',
    loading: 'Kinukuha ang impormasyon…', loadError: 'Hindi namin makuha ang listahan ng dokumento.', retry: 'Subukan muli', emptyCatalog: 'Walang dokumentong maaaring hilingin sa ngayon. Pakibalik muli mamaya.',
    requirements: 'Mga kakailanganin', startRequest: 'Humiling ng dokumentong ito', backDocuments: 'Bumalik sa mga dokumento', documentNotFound: 'Hindi available o hindi na aktibo ang dokumentong ito.',
    description: 'Tungkol sa dokumento', requestTitle: 'Humiling', applicantDetails: 'Iyong mga detalye', fullName: 'Buong pangalan', contactNumber: 'Numero ng telepono', address: 'Tirahan', yourInformation: 'Impormasyong kailangan para sa dokumentong ito',
    required: 'Kailangan', optional: 'Opsyonal', submit: 'Ipadala ang kahilingan', submitting: 'Ipinapadala…', submitHelp: 'Direktang ipinapadala ang iyong impormasyon sa sistema ng kahilingan ng barangay.',
    formError: 'Hindi naipadala ang kahilingan. Nananatili ang iyong mga inilagay. Suriin ang mga ito at subukan muli.', serverValidation: 'Suriin ang impormasyong ito at subukan muli.',
    networkError: 'Hindi namin maabot ang serbisyo. Suriin ang iyong koneksyon at subukan muli.', timeoutError: 'Masyadong matagal bago sumagot ang serbisyo.', invalidResponse: 'Hindi mabasa ang tugon mula sa serbisyo.', validationError: 'May impormasyong hindi tinanggap. Suriin ang form at subukan muli.', authenticationError: 'Kailangan ng pagpapatunay para sa kahilingang ito.', forbiddenError: 'Hindi available ang aksiyong ito. I-refresh ang pahina o makipag-ugnayan sa barangay.', requestNotFound: 'Hindi na available ang hinihinging impormasyon.', conflictError: 'Hindi nakumpleto ang kahilingan dahil nagbago ang impormasyon.', preconditionError: 'Maaaring luma na ang pahina. I-refresh ito at subukan muli.', payloadTooLarge: 'Masyadong malaki ang kahilingan. Paikliin ang impormasyon at subukan muli.', rateLimit: 'Napakaraming pagsubok. Maghintay ng {{seconds}} segundo bago subukan muli.', rateLimitGeneric: 'Napakaraming pagsubok. Maghintay muna bago subukan muli.', serverError: 'Pansamantalang hindi available ang serbisyo. Subukan muli mamaya.', apiError: 'Hindi nakumpleto ang kahilingan. Subukan muli.', supportRequestId: 'Reference para sa suporta: {{id}}.',
    submissionUncertainTitle: 'Hindi namin makumpirma ang resulta', submissionSending: 'Ipinapadala pa ang iyong kahilingan. Pakihintay.', submissionUncertain: 'Maaaring natanggap ng barangay ang kahilingan. Ulitin ang eksaktong kahilingang ito upang ligtas na alamin ang resulta, o tahasang piliing magsimula ng bago.', submissionReplayExpired: 'Natapos na ang ligtas na panahon para sa muling pagsubok. Maaaring natanggap na ang kahilingan; makipag-ugnayan muna sa barangay bago magpadala ng panibago.', submissionReloadWarning: 'Na-refresh ang pahina kaya hindi na ligtas ulitin ang orihinal na kahilingan. Maaaring natanggap na ito.', retrySameSubmission: 'Ulitin ang parehong kahilingan', startNewAfterUncertain: 'Nauunawaan ko; magsimula ng bagong kahilingan', confirmationUnavailable: 'Makikita lamang ang kumpirmasyong ito sa aktibong tab at mawawala pagkalipas ng ilang sandali. Hindi maibabalik ang pribadong tracking credential kapag ni-refresh o direktang binuksan ang pahina.',
    confirmationTitle: 'Naipadala ang iyong kahilingan', confirmationText: 'Itago ang dalawang detalye sa ibaba. Kailangan ang reference at pribadong tracking credential upang masubaybayan ang progreso. Panatilihing pribado ang tracking credential.',
    reference: 'Reference ng kahilingan', trackingCredential: 'Pribadong tracking credential', copy: 'Kopyahin', copied: 'Nakopya', copyFailed: 'Hindi makopya. Piliin at kopyahin ito nang mano-mano.',
    nextTrack: 'Subaybayan ang kahilingang ito', saveReminder: 'Itago ang mga detalyeng ito sa ligtas na lugar, lalo na sa shared device. Pansamantala lamang itong itinatago ng tab na ito; hindi ito ipinapadala sa email o text.',
    trackTitle: 'Subaybayan ang kahilingan', trackText: 'Ilagay ang reference at pribadong tracking credential na natanggap matapos magsumite.',
    checkProgress: 'Tingnan ang progreso', checking: 'Sinusuri…', trackError: 'Walang nakitang kahilingan para sa mga detalyeng ito. Suriin ang dalawa at subukan muli.',
    trackResult: 'Progreso ng kahilingan', submittedOn: 'Naipadala noong', expectedDate: 'Inaasahang petsa ng paglabas', expectedHelp: 'Inaasahang petsa ito. Hindi ibig sabihin nito na maaari nang kunin ang dokumento.',
    readyAt: 'Handa nang kunin', releasedAt: 'Naipamahagi', noDate: 'Wala pang itinakda', status: 'Kalagayan', statusMessage: 'Update', progressPrivate: 'Progreso lamang ng kahilingan ang ipinapakita rito. Hindi ipinapakita ang detalye ng aplikante.',
    status_SUBMITTED: 'Naipadala', status_UNDER_REVIEW: 'Sinusuri', status_PROCESSING: 'Pinoproseso', status_READY_FOR_PICKUP: 'Handa nang kunin', status_RELEASED: 'Naipamahagi', status_REJECTED: 'Hindi naaprubahan', status_CANCELLED: 'Kinansela',
    notReady: 'Hindi pa minarkahang handa', notReleased: 'Hindi pa naipapamahagi', footer: 'Mga kahilingan para sa dokumento ng barangay', footerNote: 'Gamitin ang contact details ng iyong barangay kung may tanong tungkol sa kahilingan.',
    homeLink: 'Bumalik sa tahanan', languageName: 'Filipino', dynamicHelp: 'Ilagay ang impormasyong hinihingi sa ibaba.', serverReference: 'Kung makikipag-ugnayan sa barangay, ibigay ang reference ng kahilingan. Huwag ibahagi sa publiko ang tracking credential.',
    nameMin: 'Maglagay ng hindi bababa sa 2 karakter.', nameMax: 'Gumamit ng hanggang 160 karakter.', contactInvalid: 'Maglagay ng wastong numero ng telepono.', addressInvalid: 'Maglagay ng tirahang may hindi bababa sa 3 karakter.',
    dynamicRequired: 'Kailangan ang {{label}}.', dynamicMax: 'Dapat hindi hihigit sa 1,000 karakter ang {{label}}.', dynamicDate: 'Maglagay ng wastong petsa para sa {{label}}.', dynamicOption: 'Pumili ng opsyon mula sa listahan para sa {{label}}.',
    referenceInvalid: 'Maglagay ng wastong reference ng kahilingan.', credentialInvalid: 'Ilagay ang iyong pribadong tracking credential.',
    skipToMain: 'Lumaktaw sa pangunahing nilalaman', mainNavigation: 'Pangunahing nabigasyon', switchLanguage: 'Palitan ang wika',
    documentCount_one: '{{count}} uri ng dokumento', documentCount_other: '{{count}} uri ng dokumento',
  } },
} as const;

export const languageStorageKey = 'barangay-ui-language-v1';

function getStorage(): Pick<Storage, 'getItem' | 'setItem'> | null {
  try { return window.localStorage; } catch { return null; }
}

export function getInitialLanguage(storage: Pick<Storage, 'getItem'> | null = getStorage()): 'en' | 'fil' {
  try { return storage?.getItem(languageStorageKey) === 'fil' ? 'fil' : 'en'; } catch { return 'en'; }
}

function syncDocumentLanguage(language: string, persist = false) {
  const supported = language.startsWith('fil') ? 'fil' : 'en';
  document.documentElement.lang = supported;
  document.title = String(i18n.t('documentTitle', { lng: supported }));
  document.querySelector('meta[name="description"]')?.setAttribute('content', String(i18n.t('documentDescription', { lng: supported })));
  if (persist) { try { getStorage()?.setItem(languageStorageKey, supported); } catch { /* Storage can be unavailable in private browsing. */ } }
}

void i18n.use(initReactI18next).init({
  resources,
  lng: getInitialLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});
i18n.on('languageChanged', (language) => syncDocumentLanguage(language, true));
syncDocumentLanguage(i18n.language);

export default i18n;
