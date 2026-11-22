/**
 * The wording of the store's policy pages (delivery, exchanges, privacy,
 * terms) and of the help page, in both languages. The terms themselves
 * (delivery hours, exchange days) come from config/policies.ts and are filled
 * into the {braces} when a page is rendered, so the pages can't contradict the
 * product page.
 *
 * What the store promises, as the owner set it: cash on delivery, free
 * delivery everywhere in Morocco within 24 to 72 hours of the confirmation
 * call, and a size exchange within 7 days of delivery for an unworn piece.
 */
import type { Locale } from "@/lib/i18n";
import type { PolicyKey } from "./policies";

export interface PolicySection {
  id: string;
  heading: string;
  paragraphs?: string[];
  list?: string[];
}

export interface PolicyDoc {
  /** <title> and the page heading */
  title: string;
  /** Meta description */
  description: string;
  intro: string;
  sections: PolicySection[];
}

export interface PolicyCopy {
  eyebrow: string;
  /** "{date}" is the effective date */
  effective: string;
  help: string;
  questions: string;
  questionsText: string;
  operatedBy: string;
  docs: Record<PolicyKey, PolicyDoc>;
  support: {
    title: string;
    description: string;
    intro: string;
    quick: string;
    contact: string;
    contactIntro: string;
    whatsapp: string;
    phone: string;
    email: string;
    noContact: string;
  };
}

export const policyContent: Record<Locale, PolicyCopy> = {
  fr: {
    eyebrow: "Informations Chrilik",
    effective: "En vigueur depuis le {date}",
    help: "Aide et contact",
    questions: "Une question ?",
    questionsText: "Contactez-nous depuis la page Aide et contact : nous vous répondons rapidement.",
    operatedBy: "{brand} est exploité par {name}",
    docs: {
      shipping: {
        title: "Livraison",
        description: "Livraison gratuite partout au Maroc en {min} à {max} heures, paiement en espèces à la réception.",
        intro: "La livraison est gratuite partout au Maroc, et vous payez à la réception.",
        sections: [
          { id: "gratuite", heading: "Livraison gratuite", paragraphs: ["La livraison est gratuite pour toutes les commandes, sans minimum d'achat. Le prix affiché sur le site est le prix que vous payez au livreur."] },
          { id: "villes", heading: "Où livrons-nous ?", paragraphs: ["Nous livrons dans toutes les villes du Maroc. Si votre ville ne figure pas dans la liste du formulaire, choisissez « Autre ville » et indiquez son nom."] },
          {
            id: "confirmation",
            heading: "Confirmation par téléphone",
            paragraphs: ["Après votre commande, nous vous appelons au numéro indiqué pour la confirmer et vérifier votre adresse. La commande est préparée dès qu'elle est confirmée.", "Si nous n'arrivons pas à vous joindre, nous réessayons. Sans confirmation, la commande n'est pas expédiée."],
          },
          { id: "delai", heading: "Délai de livraison", paragraphs: ["Le colis est livré en {min} à {max} heures après la confirmation, selon votre ville. Le livreur vous appelle avant de passer."] },
          { id: "paiement", heading: "Paiement à la livraison", paragraphs: ["Vous réglez en espèces au livreur, au moment où il vous remet le colis. Aucun paiement n'est demandé sur le site."] },
          { id: "modifier", heading: "Changer d'adresse ou de numéro", paragraphs: ["Contactez-nous dès que possible avec votre référence de commande : tant que le colis n'est pas parti, nous modifions l'adresse ou le numéro de téléphone."] },
          { id: "probleme", heading: "Colis en retard ou abîmé", paragraphs: ["Si votre colis n'arrive pas dans le délai annoncé, ou s'il arrive abîmé, contactez-nous : nous suivons la livraison avec le transporteur et nous remplaçons l'article si nécessaire."] },
        ],
      },
      returns: {
        title: "Échanges et retours",
        description: "Échange de taille sous {days} jours après la livraison, pour une pièce non portée.",
        intro: "Si la taille ne convient pas, nous l'échangeons.",
        sections: [
          { id: "echange", heading: "Échange sous {days} jours", paragraphs: ["Vous avez {days} jours à partir de la livraison pour demander un échange de taille ou de couleur."] },
          {
            id: "conditions",
            heading: "Conditions",
            list: ["La pièce n'a été ni portée ni lavée (vous pouvez bien sûr l'essayer).", "Elle est renvoyée dans son emballage d'origine.", "Pour des raisons d'hygiène, une pièce portée ou lavée ne peut être ni reprise ni échangée."],
          },
          { id: "demande", heading: "Comment demander un échange", paragraphs: ["Contactez-nous par WhatsApp ou par téléphone avec votre référence de commande et la taille souhaitée. Nous organisons le passage du livreur, qui vous remet la nouvelle pièce et reprend la première."] },
          { id: "frais", heading: "Frais d'échange", paragraphs: ["Les frais de livraison de l'échange sont à la charge du client. Si nous avons envoyé un article différent de celui commandé, ou un article défectueux, l'échange est entièrement gratuit."] },
          { id: "defaut", heading: "Article défectueux ou erreur de notre part", paragraphs: ["Prévenez-nous dans les {days} jours qui suivent la livraison, avec une photo si possible. Nous remplaçons l'article sans frais ou, s'il n'est plus disponible, nous vous remboursons."] },
        ],
      },
      privacy: {
        title: "Confidentialité",
        description: "Les données que Chrilik collecte pour livrer votre commande, et vos droits.",
        intro: "Nous collectons uniquement ce qu'il faut pour confirmer et livrer votre commande.",
        sections: [
          { id: "donnees", heading: "Les données que nous collectons", paragraphs: ["Quand vous commandez : votre nom, votre numéro de téléphone, votre ville et votre adresse de livraison. Nous ne collectons aucune donnée de paiement : le paiement se fait en espèces à la livraison."] },
          { id: "usage", heading: "À quoi elles servent", paragraphs: ["À confirmer votre commande par téléphone, à la livrer et à assurer le service après-vente (échange, réclamation)."] },
          { id: "partage", heading: "Avec qui nous les partageons", paragraphs: ["Avec la société de livraison, qui reçoit votre nom, votre téléphone et votre adresse pour vous remettre le colis. Nous ne vendons pas vos données."] },
          {
            id: "publicite",
            heading: "Mesure de nos publicités et cookies",
            paragraphs: [
              "Le site utilise le pixel Meta (Facebook, Instagram) et son équivalent côté serveur pour mesurer l'efficacité de nos publicités : pages vues, ajout au panier et commande, avec votre numéro de téléphone sous forme hachée. Un cookie garde en mémoire, pendant 30 jours, la publicité qui vous a amené sur le site.",
              "Si votre navigateur envoie le signal « Global Privacy Control », le pixel n'est pas chargé. Un autre cookie retient la langue que vous avez choisie.",
            ],
          },
          { id: "duree", heading: "Durée de conservation", paragraphs: ["Nous conservons les informations de commande le temps nécessaire au suivi de la commande et à nos obligations comptables."] },
          { id: "droits", heading: "Vos droits", paragraphs: ["Conformément à la loi 09-08 relative à la protection des personnes physiques à l'égard du traitement des données à caractère personnel, vous pouvez demander l'accès à vos données, leur rectification ou leur suppression, et vous opposer à leur utilisation. Contactez-nous : nous répondons dans les meilleurs délais."] },
        ],
      },
      terms: {
        title: "Conditions générales de vente",
        description: "Les conditions de commande, de prix, de paiement et de livraison sur Chrilik.",
        intro: "Ces conditions s'appliquent à toute commande passée sur ce site.",
        sections: [
          { id: "commande", heading: "Commande", paragraphs: ["Vous commandez en remplissant le formulaire du site. La commande est ferme une fois confirmée avec vous par téléphone."] },
          { id: "prix", heading: "Prix", paragraphs: ["Les prix sont indiqués en dirhams (DH), toutes taxes comprises, livraison incluse. Le prix applicable est celui affiché au moment de la commande."] },
          { id: "paiement", heading: "Paiement", paragraphs: ["Le paiement se fait en espèces, à la livraison."] },
          { id: "livraison", heading: "Livraison", paragraphs: ["Livraison gratuite partout au Maroc en {min} à {max} heures après la confirmation. Les détails sont sur la page Livraison."] },
          { id: "echanges", heading: "Échanges et retours", paragraphs: ["Une taille peut être échangée dans les {days} jours qui suivent la livraison. Les conditions sont sur la page Échanges et retours."] },
          { id: "stock", heading: "Disponibilité", paragraphs: ["Les articles sont proposés dans la limite des stocks disponibles. Si un article commandé n'est plus disponible, nous vous prévenons lors de l'appel de confirmation."] },
          { id: "droit", heading: "Droit applicable", paragraphs: ["Les présentes conditions sont soumises au droit marocain."] },
        ],
      },
    },
    support: {
      title: "Aide et contact",
      description: "Livraison, échanges, paiement à la livraison et comment contacter Chrilik.",
      intro: "Une question sur votre commande ? Voici l'essentiel, et comment nous joindre.",
      quick: "L'essentiel",
      contact: "Nous contacter",
      contactIntro: "Indiquez votre référence de commande : nous vous répondons plus vite.",
      whatsapp: "WhatsApp",
      phone: "Téléphone",
      email: "E-mail",
      noContact: "Nous vous appelons pour confirmer chaque commande : gardez votre téléphone à portée de main.",
    },
  },
  ar: {
    eyebrow: "معلومات شري ليك",
    effective: "سارية المفعول منذ {date}",
    help: "المساعدة والتواصل",
    questions: "عندك سؤال؟",
    questionsText: "تواصلي معنا من صفحة المساعدة والتواصل: نجيبك في أقرب وقت.",
    operatedBy: "{brand} تديره شركة {name}",
    docs: {
      shipping: {
        title: "التوصيل",
        description: "التوصيل مجاني لجميع مدن المغرب خلال {min} إلى {max} ساعة، والدفع نقداً عند الاستلام.",
        intro: "التوصيل مجاني لجميع مدن المغرب، والدفع عند الاستلام.",
        sections: [
          { id: "gratuite", heading: "التوصيل مجاني", paragraphs: ["التوصيل مجاني لجميع الطلبات وبدون حد أدنى. السعر المعروض في الموقع هو المبلغ الذي تدفعينه لعامل التوصيل."] },
          { id: "villes", heading: "أين نوصل؟", paragraphs: ["نوصل إلى جميع مدن المغرب. إذا لم تجدي مدينتك في قائمة الاستمارة، اختاري «مدينة أخرى» واكتبي اسمها."] },
          {
            id: "confirmation",
            heading: "تأكيد الطلب بالهاتف",
            paragraphs: ["بعد تسجيل طلبك نتصل بك على الرقم الذي أدخلته لتأكيده والتحقق من العنوان. يتم تجهيز الطلب فور تأكيده.", "إذا لم نتمكن من الاتصال بك نعيد المحاولة. بدون تأكيد لا يتم إرسال الطلب."],
          },
          { id: "delai", heading: "مدة التوصيل", paragraphs: ["يصلك الطرد خلال {min} إلى {max} ساعة بعد التأكيد، حسب مدينتك. يتصل بك عامل التوصيل قبل قدومه."] },
          { id: "paiement", heading: "الدفع عند الاستلام", paragraphs: ["تدفعين نقداً لعامل التوصيل عند تسلّم الطرد. لا يُطلب أي أداء على الموقع."] },
          { id: "modifier", heading: "تغيير العنوان أو رقم الهاتف", paragraphs: ["تواصلي معنا في أقرب وقت مع رقم طلبك: ما دام الطرد لم يخرج بعد، نعدّل العنوان أو رقم الهاتف."] },
          { id: "probleme", heading: "تأخر الطرد أو وصوله متضرراً", paragraphs: ["إذا لم يصلك الطرد في المدة المحددة، أو وصل متضرراً، تواصلي معنا: نتابع التوصيل مع شركة النقل ونستبدل المنتج عند الحاجة."] },
        ],
      },
      returns: {
        title: "الاستبدال والاسترجاع",
        description: "استبدال المقاس خلال {days} أيام من تاريخ الاستلام، للقطعة التي لم تُلبس.",
        intro: "إذا لم يناسبك المقاس نستبدله لك.",
        sections: [
          { id: "echange", heading: "الاستبدال خلال {days} أيام", paragraphs: ["لديك {days} أيام من تاريخ الاستلام لطلب استبدال المقاس أو اللون."] },
          {
            id: "conditions",
            heading: "الشروط",
            list: ["ألا تكون القطعة قد لُبست أو غُسلت (يمكنك طبعاً قياسها).", "أن تُعاد في غلافها الأصلي.", "لأسباب صحية، لا يمكن استرجاع أو استبدال قطعة لُبست أو غُسلت."],
          },
          { id: "demande", heading: "كيف تطلبين الاستبدال", paragraphs: ["تواصلي معنا عبر واتساب أو الهاتف مع رقم طلبك والمقاس المطلوب. ننظّم مرور عامل التوصيل الذي يسلّمك القطعة الجديدة ويستلم الأولى."] },
          { id: "frais", heading: "مصاريف الاستبدال", paragraphs: ["مصاريف توصيل الاستبدال على عاتق الزبونة. إذا أرسلنا منتجاً غير الذي طلبته، أو منتجاً به عيب، فالاستبدال مجاني تماماً."] },
          { id: "defaut", heading: "منتج به عيب أو خطأ من طرفنا", paragraphs: ["أخبرينا خلال {days} أيام من تاريخ الاستلام، مع صورة إن أمكن. نستبدل المنتج مجاناً، وإذا لم يعد متوفراً نُرجع لك المبلغ."] },
        ],
      },
      privacy: {
        title: "سياسة الخصوصية",
        description: "المعطيات التي يجمعها شري ليك لتوصيل طلبك، وحقوقك.",
        intro: "لا نجمع إلا ما نحتاجه لتأكيد طلبك وتوصيله.",
        sections: [
          { id: "donnees", heading: "المعطيات التي نجمعها", paragraphs: ["عند الطلب: اسمك، رقم هاتفك، مدينتك وعنوان التوصيل. لا نجمع أي معطيات خاصة بالأداء: الدفع يتم نقداً عند الاستلام."] },
          { id: "usage", heading: "فيمَ نستعملها", paragraphs: ["لتأكيد طلبك بالهاتف، وتوصيله، وخدمة ما بعد البيع (الاستبدال والشكايات)."] },
          { id: "partage", heading: "مع من نتقاسمها", paragraphs: ["مع شركة التوصيل التي تتوصل باسمك ورقم هاتفك وعنوانك لتسليمك الطرد. لا نبيع معطياتك."] },
          {
            id: "publicite",
            heading: "قياس الإعلانات وملفات تعريف الارتباط",
            paragraphs: [
              "يستعمل الموقع بيكسل ميتا (فيسبوك وإنستغرام) ونظيره من جهة الخادم لقياس فعالية إعلاناتنا: الصفحات التي تمت زيارتها، الإضافة إلى السلة والطلب، مع رقم هاتفك في صيغة مشفّرة. ويحتفظ ملف تعريف ارتباط لمدة 30 يوماً بالإعلان الذي قادك إلى الموقع.",
              "إذا كان متصفحك يرسل إشارة «Global Privacy Control» فلا يتم تحميل البيكسل. ويحتفظ ملف آخر باللغة التي اخترتها.",
            ],
          },
          { id: "duree", heading: "مدة الاحتفاظ", paragraphs: ["نحتفظ بمعلومات الطلب للمدة اللازمة لتتبعه ولالتزاماتنا المحاسبية."] },
          { id: "droits", heading: "حقوقك", paragraphs: ["طبقاً للقانون 09-08 المتعلق بحماية الأشخاص الذاتيين تجاه معالجة المعطيات ذات الطابع الشخصي، يمكنك طلب الاطلاع على معطياتك أو تصحيحها أو حذفها، والاعتراض على استعمالها. تواصلي معنا ونجيبك في أقرب وقت."] },
        ],
      },
      terms: {
        title: "الشروط العامة للبيع",
        description: "شروط الطلب والأسعار والدفع والتوصيل في شري ليك.",
        intro: "تطبَّق هذه الشروط على كل طلب يتم عبر هذا الموقع.",
        sections: [
          { id: "commande", heading: "الطلب", paragraphs: ["يتم الطلب بملء استمارة الموقع. يصبح الطلب نهائياً بعد تأكيده معك بالهاتف."] },
          { id: "prix", heading: "الأسعار", paragraphs: ["الأسعار معروضة بالدرهم المغربي، شاملة لجميع الرسوم والتوصيل. السعر المعتمد هو المعروض وقت تسجيل الطلب."] },
          { id: "paiement", heading: "الدفع", paragraphs: ["الدفع نقداً عند الاستلام."] },
          { id: "livraison", heading: "التوصيل", paragraphs: ["التوصيل مجاني لجميع مدن المغرب خلال {min} إلى {max} ساعة بعد التأكيد. التفاصيل في صفحة التوصيل."] },
          { id: "echanges", heading: "الاستبدال والاسترجاع", paragraphs: ["يمكن استبدال المقاس خلال {days} أيام من تاريخ الاستلام. الشروط في صفحة الاستبدال والاسترجاع."] },
          { id: "stock", heading: "التوفر", paragraphs: ["المنتجات معروضة في حدود المخزون المتوفر. إذا لم يعد المنتج المطلوب متوفراً نخبرك بذلك عند اتصال التأكيد."] },
          { id: "droit", heading: "القانون المطبق", paragraphs: ["تخضع هذه الشروط للقانون المغربي."] },
        ],
      },
    },
    support: {
      title: "المساعدة والتواصل",
      description: "التوصيل، الاستبدال، الدفع عند الاستلام وطريقة التواصل مع شري ليك.",
      intro: "عندك سؤال حول طلبك؟ هنا أهم المعلومات وطريقة التواصل معنا.",
      quick: "أهم المعلومات",
      contact: "تواصلي معنا",
      contactIntro: "اذكري رقم طلبك لنجيبك بسرعة.",
      whatsapp: "واتساب",
      phone: "الهاتف",
      email: "البريد الإلكتروني",
      noContact: "نتصل بك لتأكيد كل طلب: يُرجى إبقاء هاتفك قريباً منك.",
    },
  },
};
