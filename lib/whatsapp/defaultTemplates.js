// 21 templates PROPOSÉS couvrant le parcours client (TP-08).
// ⚠️ Le cahier des charges renvoie aux « 21 templates du dossier de
// conception », non fourni : ces textes sont une proposition de départ,
// chargés en BROUILLON (jamais soumis automatiquement à Meta), à relire et
// faire valider par l'agence — en particulier la version arabe.
// Règles Meta respectées : variables {{n}} consécutives, jamais en début ni
// en fin de message, pas de mots promotionnels dans les templates "Utilité".

const STOP_FR = "Répondez STOP pour ne plus recevoir nos offres";
const STOP_AR = "أرسلوا STOP لإيقاف توصلكم بعروضنا";

export const DEFAULT_TEMPLATES = [
  {
    name: "gf_inscription_confirmee",
    category: "UTILITY",
    description: "Inscription enregistrée",
    mapping: { "body.1": "contact.prenom", "body.2": "programme.titre", "body.3": "voyage.date_depart", "body.4": "inscription.reference" },
    fr: { body: "Bonjour {{1}}, votre inscription au programme {{2}} (départ le {{3}}) est bien enregistrée sous le numéro de dossier {{4}}. Nous restons à votre disposition pour toute question." },
    ar: { body: "مرحبا {{1}}، تم تسجيلكم في برنامج {{2}} (الانطلاق يوم {{3}}) تحت رقم الملف {{4}}. نحن رهن إشارتكم لأي استفسار." },
  },
  {
    name: "gf_documents_manquants",
    category: "UTILITY",
    description: "Documents manquants au dossier",
    mapping: { "body.1": "contact.prenom", "body.2": "programme.titre", "body.3": "inscription.documents_manquants" },
    fr: { body: "Bonjour {{1}}, pour finaliser votre dossier du programme {{2}}, il nous manque encore : {{3}}. Merci de nous les envoyer en photo nette sur ce numéro." },
    ar: { body: "مرحبا {{1}}، لاستكمال ملفكم الخاص ببرنامج {{2}}، ما زال ينقصنا : {{3}}. المرجو إرسالها في صورة واضحة على هذا الرقم." },
  },
  {
    name: "gf_rappel_documents",
    category: "UTILITY",
    description: "Relance documents avant le départ",
    mapping: { "body.1": "contact.prenom", "body.2": "programme.titre", "body.3": "inscription.documents_manquants" },
    fr: { body: "Bonjour {{1}}, petit rappel : le départ du programme {{2}} approche et votre dossier est encore incomplet ({{3}}). Merci de nous envoyer ces documents dès que possible." },
    ar: { body: "مرحبا {{1}}، تذكير : موعد انطلاق برنامج {{2}} يقترب وملفكم ما زال غير مكتمل ({{3}}). المرجو إرسال هذه الوثائق في أقرب وقت." },
  },
  {
    name: "gf_paiement_recu",
    category: "UTILITY",
    description: "Confirmation d'un versement",
    mapping: { "body.1": "contact.prenom", "body.2": "paiement.montant", "body.3": "programme.titre", "body.4": "inscription.solde" },
    fr: { body: "Bonjour {{1}}, nous confirmons la réception de votre paiement de {{2}} pour le programme {{3}}. Reste à payer : {{4}}. Merci de votre confiance." },
    ar: { body: "مرحبا {{1}}، نؤكد لكم توصلنا بدفعتكم بمبلغ {{2}} الخاصة ببرنامج {{3}}. المبلغ المتبقي : {{4}}. شكرا على ثقتكم." },
  },
  {
    name: "gf_rappel_solde",
    category: "UTILITY",
    description: "Rappel du reste à payer",
    mapping: { "body.1": "contact.prenom", "body.2": "programme.titre", "body.3": "voyage.date_depart", "body.4": "inscription.solde" },
    fr: { body: "Bonjour {{1}}, le départ du programme {{2}} est prévu le {{3}}. Le reste à payer de votre dossier est de {{4}}. Votre conseiller reste disponible pour toute question." },
    ar: { body: "مرحبا {{1}}، انطلاق برنامج {{2}} مقرر يوم {{3}}. المبلغ المتبقي في ملفكم هو {{4}}. مستشاركم رهن إشارتكم لأي استفسار." },
  },
  {
    name: "gf_solde_regle",
    category: "UTILITY",
    description: "Dossier entièrement réglé",
    mapping: { "body.1": "contact.prenom", "body.2": "inscription.reference" },
    fr: { body: "Bonjour {{1}}, votre dossier {{2}} est entièrement réglé. Merci ! Nous vous enverrons prochainement les informations pratiques du voyage." },
    ar: { body: "مرحبا {{1}}، تم أداء جميع مستحقات ملفكم {{2}}. شكرا لكم ! سنرسل لكم قريبا المعلومات العملية الخاصة بالرحلة." },
  },
  {
    name: "gf_visa_en_cours",
    category: "UTILITY",
    description: "Demande de visa déposée",
    mapping: { "body.1": "contact.prenom", "body.2": "programme.titre" },
    fr: { body: "Bonjour {{1}}, votre demande de visa pour le programme {{2}} est en cours de traitement. Nous vous informerons dès que nous aurons la réponse." },
    ar: { body: "مرحبا {{1}}، طلب التأشيرة الخاص ببرنامج {{2}} قيد المعالجة. سنخبركم فور توصلنا بالرد." },
  },
  {
    name: "gf_visa_accorde",
    category: "UTILITY",
    description: "Visa accordé",
    mapping: { "body.1": "contact.prenom", "body.2": "programme.titre" },
    fr: { body: "Bonne nouvelle {{1}} : votre visa pour le programme {{2}} a été accordé. Nous vous communiquerons bientôt les détails du départ." },
    ar: { body: "خبر سار {{1}} : تم قبول تأشيرتكم الخاصة ببرنامج {{2}}. سنوافيكم قريبا بتفاصيل الانطلاق." },
  },
  {
    name: "gf_visa_action_requise",
    category: "UTILITY",
    description: "Visa : action requise du client (refus, complément)",
    mapping: { "body.1": "contact.prenom", "body.2": "programme.titre" },
    fr: { body: "Bonjour {{1}}, le traitement de votre visa pour le programme {{2}} nécessite une action de votre part. Merci de contacter votre conseiller en répondant à ce message." },
    ar: { body: "مرحبا {{1}}، معالجة تأشيرتكم الخاصة ببرنامج {{2}} تتطلب إجراء من طرفكم. المرجو التواصل مع مستشاركم بالرد على هذه الرسالة." },
  },
  {
    name: "gf_billet_emis",
    category: "UTILITY",
    description: "Billet d'avion émis",
    mapping: { "body.1": "contact.prenom", "body.2": "programme.titre", "body.3": "voyage.compagnie", "body.4": "voyage.date_depart", "body.5": "voyage.pnr" },
    fr: { body: "Bonjour {{1}}, votre billet pour le programme {{2}} est émis : vol {{3}} du {{4}}, référence de réservation {{5}}. Gardez ce message pour le jour du départ." },
    ar: { body: "مرحبا {{1}}، تم إصدار تذكرتكم الخاصة ببرنامج {{2}} : رحلة {{3}} يوم {{4}}، مرجع الحجز {{5}}. احتفظوا بهذه الرسالة ليوم السفر." },
  },
  {
    name: "gf_reunion_pre_depart",
    category: "UTILITY",
    description: "Réunion d'information avant le départ (date saisie à l'envoi)",
    mapping: { "body.1": "contact.prenom", "body.2": "programme.titre", "body.3": "texte.libre" },
    fr: { body: "Bonjour {{1}}, une réunion d'information avant le départ du programme {{2}} aura lieu le {{3}} à l'agence. Merci de confirmer votre présence en répondant à ce message." },
    ar: { body: "مرحبا {{1}}، سيتم تنظيم اجتماع إخباري قبل انطلاق برنامج {{2}} يوم {{3}} بمقر الوكالة. المرجو تأكيد حضوركم بالرد على هذه الرسالة." },
  },
  {
    name: "gf_rappel_depart",
    category: "UTILITY",
    description: "Rappel avant le départ (J-7)",
    mapping: { "body.1": "contact.prenom", "body.2": "programme.titre", "body.3": "voyage.jours_avant_depart", "body.4": "voyage.date_depart" },
    fr: { body: "Bonjour {{1}}, le départ du programme {{2}} est dans {{3}} jours, le {{4}}. Pensez à vérifier votre passeport et à préparer vos bagages." },
    ar: { body: "مرحبا {{1}}، موعد انطلاق برنامج {{2}} بعد {{3}} أيام، يوم {{4}}. المرجو التأكد من جواز السفر وتحضير الأمتعة." },
  },
  {
    name: "gf_convocation_aeroport",
    category: "UTILITY",
    description: "Convocation à l'aéroport (J-1)",
    mapping: { "body.1": "contact.prenom", "body.2": "programme.titre", "body.3": "voyage.compagnie", "body.4": "voyage.ville_depart" },
    fr: { body: "Bonjour {{1}}, demain c'est le départ du programme {{2}} : vol {{3}} au départ de {{4}}. Merci d'être à l'aéroport 3 heures avant le décollage avec votre passeport." },
    ar: { body: "مرحبا {{1}}، غدا موعد انطلاق برنامج {{2}} : رحلة {{3}} انطلاقا من {{4}}. المرجو الحضور إلى المطار 3 ساعات قبل الإقلاع مع جواز السفر." },
  },
  {
    name: "gf_changement_vol",
    category: "UTILITY",
    description: "Changement de vol (urgent, détails saisis à l'envoi)",
    mapping: { "body.1": "contact.prenom", "body.2": "programme.titre", "body.3": "texte.libre" },
    fr: { body: "Information importante {{1}} : le vol de votre programme {{2}} a été modifié. Détails : {{3}}. Votre conseiller reste joignable sur ce numéro." },
    ar: { body: "معلومة مهمة {{1}} : تم تغيير رحلة برنامجكم {{2}}. التفاصيل : {{3}}. مستشاركم رهن إشارتكم على هذا الرقم." },
  },
  {
    name: "gf_hebergement_confirme",
    category: "UTILITY",
    description: "Hébergement attribué",
    mapping: { "body.1": "contact.prenom", "body.2": "programme.titre", "body.3": "hebergement.hotels" },
    fr: { body: "Bonjour {{1}}, votre hébergement pour le programme {{2}} est confirmé : {{3}}. Nous vous souhaitons un excellent séjour." },
    ar: { body: "مرحبا {{1}}، تم تأكيد إقامتكم الخاصة ببرنامج {{2}} : {{3}}. نتمنى لكم إقامة طيبة." },
  },
  {
    name: "gf_bon_retour",
    category: "UTILITY",
    description: "Après le retour (J+2)",
    mapping: { "body.1": "contact.prenom", "body.2": "programme.titre" },
    fr: { body: "Bonjour {{1}}, nous espérons que le programme {{2}} s'est bien passé. Toute l'équipe vous souhaite un bon retour parmi les vôtres." },
    ar: { body: "مرحبا {{1}}، نتمنى أن يكون برنامج {{2}} قد مر في أحسن الظروف. يتمنى لكم فريقنا عودة ميمونة بين أهلكم." },
  },
  {
    name: "gf_avis_satisfaction",
    category: "UTILITY",
    description: "Questionnaire de satisfaction (J+7)",
    mapping: { "body.1": "contact.prenom", "body.2": "programme.titre" },
    fr: {
      body: "Bonjour {{1}}, votre avis sur le programme {{2}} nous aide à nous améliorer. Comment évaluez-vous votre voyage ?",
      buttons: [{ type: "QUICK_REPLY", text: "Très satisfait" }, { type: "QUICK_REPLY", text: "Satisfait" }, { type: "QUICK_REPLY", text: "Pas satisfait" }],
    },
    ar: {
      body: "مرحبا {{1}}، رأيكم في برنامج {{2}} يساعدنا على التحسن. كيف تقيمون رحلتكم ؟",
      buttons: [{ type: "QUICK_REPLY", text: "راض جدا" }, { type: "QUICK_REPLY", text: "راض" }, { type: "QUICK_REPLY", text: "غير راض" }],
    },
  },
  {
    name: "gf_relance_prospect",
    category: "MARKETING",
    description: "Relance d'un prospect resté sans réponse",
    mapping: { "body.1": "contact.prenom" },
    fr: {
      body: "Bonjour {{1}}, vous vous êtes intéressé(e) à nos voyages. Souhaitez-vous qu'un conseiller vous rappelle pour préparer votre projet ?",
      footer: STOP_FR,
      buttons: [{ type: "QUICK_REPLY", text: "Oui, rappelez-moi" }, { type: "QUICK_REPLY", text: "Plus tard" }],
    },
    ar: {
      body: "مرحبا {{1}}، لقد أبديتم اهتمامكم برحلاتنا. هل ترغبون في أن يتصل بكم أحد مستشارينا لتحضير مشروعكم ؟",
      footer: STOP_AR,
      buttons: [{ type: "QUICK_REPLY", text: "نعم، اتصلوا بي" }, { type: "QUICK_REPLY", text: "لاحقا" }],
    },
  },
  {
    name: "gf_nouveau_programme",
    category: "MARKETING",
    description: "Annonce d'un nouveau programme (nom saisi à l'envoi)",
    mapping: { "body.1": "contact.prenom", "body.2": "texte.libre" },
    fr: { headerType: "TEXT", headerText: "Nouveau programme", body: "Bonjour {{1}}, notre nouveau programme {{2}} est ouvert aux inscriptions. Les places sont limitées : répondez à ce message pour recevoir le détail.", footer: STOP_FR },
    ar: { headerType: "TEXT", headerText: "برنامج جديد", body: "مرحبا {{1}}، برنامجنا الجديد {{2}} مفتوح للتسجيل. المقاعد محدودة : أجيبوا على هذه الرسالة للتوصل بالتفاصيل.", footer: STOP_AR },
  },
  {
    name: "gf_ouverture_saison",
    category: "MARKETING",
    description: "Ouverture des inscriptions d'une saison (Ramadan, Hajj...)",
    mapping: { "body.1": "contact.prenom", "body.2": "texte.libre" },
    fr: { body: "Bonjour {{1}}, les inscriptions pour la saison {{2}} sont ouvertes. Contactez-nous pour connaître les départs et réserver votre place.", footer: STOP_FR },
    ar: { body: "مرحبا {{1}}، التسجيلات الخاصة بموسم {{2}} مفتوحة. تواصلوا معنا لمعرفة مواعيد الانطلاق وحجز مقعدكم.", footer: STOP_AR },
  },
  {
    name: "gf_reprise_contact",
    category: "UTILITY",
    description: "Reprendre contact (fenêtre de 24h fermée)",
    mapping: { "body.1": "contact.prenom", "body.2": "inscription.reference" },
    fr: { body: "Bonjour {{1}}, nous souhaitons vous joindre au sujet de votre dossier {{2}}. Répondez à ce message pour reprendre la conversation avec votre conseiller." },
    ar: { body: "مرحبا {{1}}، نود التواصل معكم بخصوص ملفكم {{2}}. أجيبوا على هذه الرسالة لمواصلة المحادثة مع مستشاركم." },
  },
];

export function defaultTemplateSimple(variant) {
  return {
    headerType: variant.headerType || "NONE",
    headerText: variant.headerText || "",
    body: variant.body,
    footer: variant.footer || "",
    buttons: variant.buttons || [],
  };
}
