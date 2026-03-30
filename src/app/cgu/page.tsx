import React from "react";

const GRADIENT = "linear-gradient(135deg, #FF3B30 0%, #0A84FF 100%)";

const SECTIONS = [
  {
    title: "1. Objet et champ d'application",
    content: `Les présentes Conditions Générales d'Utilisation (ci-après « CGU ») régissent l'accès et l'utilisation de la plateforme Klasbook, accessible à l'adresse klasbook.be, éditée par Pasquale De Michele (ci-après « Klasbook », « l'éditeur »).

En créant un compte ou en utilisant le service, l'utilisateur accepte sans réserve les présentes CGU. Si vous utilisez Klasbook pour le compte d'un établissement scolaire, vous déclarez avoir l'autorité pour engager cet établissement.

Les CGU sont rédigées en français. En cas de traduction, la version française fait foi.`,
  },
  {
    title: "2. Description du service",
    content: `Klasbook est une plateforme SaaS (Software as a Service) d'assistance pédagogique destinée aux enseignants et établissements scolaires de la Fédération Wallonie-Bruxelles (FWB).

Le service comprend notamment :
— La génération d'exercices pédagogiques par intelligence artificielle, conformes aux référentiels officiels FWB/IFPC
— La gestion de classes, d'élèves et d'évaluations
— La création de bulletins conformes aux exigences FWB
— Un chatbot pédagogique ("Inspecteur FWB")
— Des outils de remédiation et de différenciation
— Un portail pour les parents et la direction d'établissement

Le service est fourni "en l'état". Klasbook s'engage à maintenir une disponibilité de 99% (hors maintenances planifiées annoncées avec 48h de préavis).`,
  },
  {
    title: "3. Accès au service et création de compte",
    content: `L'accès au service est réservé aux personnes majeures (18 ans ou plus). Les mineurs ne peuvent créer de compte sans l'autorisation expresse d'un responsable légal ou d'un établissement scolaire.

L'utilisateur est responsable de la confidentialité de ses identifiants de connexion. Toute utilisation du compte sous ses identifiants est présumée effectuée par l'utilisateur. En cas de compromission de son compte, l'utilisateur doit immédiatement en informer Klasbook à l'adresse support@klasbook.be.

Klasbook se réserve le droit de suspendre ou supprimer tout compte en cas de violation des présentes CGU, sans préavis ni indemnité.`,
  },
  {
    title: "4. Plans tarifaires et facturation",
    content: `**Plan Gratuit :** accès limité à 10 générations d'exercices par mois calendrier. Gratuit et sans engagement.

**Plan Pro Professeur :** abonnement mensuel ou annuel, tel qu'affiché sur la page /pricing. Le prix peut évoluer ; les utilisateurs existants sont prévenus 30 jours à l'avance de toute modification tarifaire.

**Plan École :** licence annuelle pour établissement, incluant plusieurs comptes professeurs. Tarif négocié avec la direction.

La facturation est assurée par Stripe. Les paiements sont effectués en euros, toutes taxes comprises (TVA belge applicable). Une facture électronique est émise à chaque transaction et disponible dans l'espace compte.

**Résiliation :** l'abonnement peut être résilié à tout moment depuis l'espace compte. La résiliation prend effet à la fin de la période en cours. Les données sont conservées 90 jours après résiliation (voir politique de confidentialité).

**Remboursement :** en cas de souscription initiale (première inscription payante), un remboursement intégral est accordé sur demande dans les 30 jours suivant la première facturation.`,
  },
  {
    title: "5. Obligations de l'utilisateur",
    content: `L'utilisateur s'engage à :

— Utiliser le service à des fins pédagogiques légitimes uniquement
— Ne pas tenter de contourner les limitations du plan gratuit par des moyens techniques
— Ne pas partager ses identifiants avec des tiers
— Ne pas utiliser le service pour générer des contenus illégaux, discriminatoires, violents ou portant atteinte aux droits de tiers
— Ne pas tenter d'accéder aux données d'autres utilisateurs
— Ne pas surcharger délibérément les serveurs (rate limiting automatique en place)
— Respecter les droits de propriété intellectuelle liés aux contenus générés
— Respecter le RGPD et la réglementation belge concernant les données des élèves qu'il saisit dans la plateforme

L'utilisateur reste seul responsable des contenus qu'il publie ou partage via Klasbook (exercices partagés par lien, communications aux parents, etc.).`,
  },
  {
    title: "6. Propriété intellectuelle",
    content: `**La plateforme Klasbook :** le code source, le design, les interfaces, les marques, les logos et tout élément constitutif de la plateforme sont la propriété exclusive de l'éditeur et protégés par le droit belge de la propriété intellectuelle.

**Les exercices générés par l'IA :** les contenus pédagogiques générés par l'IA à la demande de l'utilisateur lui appartiennent. L'utilisateur conserve tous les droits d'utilisation, de reproduction et de modification des exercices qu'il génère, sans restriction d'usage pédagogique.

**Les référentiels FWB :** les contenus issus des référentiels officiels IFPC/FWB sont la propriété du Ministère de l'Éducation de la FWB. Leur utilisation dans Klasbook est à des fins pédagogiques non commerciales, conformément à leur statut de documents publics.`,
  },
  {
    title: "7. Limitation de responsabilité",
    content: `**Contenus IA :** les exercices et suggestions générés par l'intelligence artificielle sont fournis à titre d'aide pédagogique. L'enseignant reste seul responsable du contenu qu'il utilise en classe. Klasbook ne garantit pas l'exactitude absolue de chaque contenu généré et recommande de toujours relire les exercices avant utilisation.

**Données élèves :** l'enseignant ou l'établissement scolaire est responsable de traitement pour les données des élèves qu'il saisit dans la plateforme. Klasbook agit en tant que sous-traitant pour ces données.

**Disponibilité :** Klasbook ne peut être tenu responsable des interruptions de service dues à des tiers (hébergeur, fournisseur d'IA, réseau Internet).

**En tout état de cause,** la responsabilité de Klasbook est limitée au montant des sommes effectivement payées par l'utilisateur au cours des 12 derniers mois précédant le fait générateur.`,
  },
  {
    title: "8. Données personnelles",
    content: `Le traitement des données personnelles est régi par la Politique de Confidentialité de Klasbook, disponible à l'adresse /vie-privee, qui fait partie intégrante des présentes CGU.

Klasbook respecte le Règlement Général sur la Protection des Données (RGPD, UE 2016/679) et la loi belge du 30 juillet 2018 relative à la protection des personnes physiques à l'égard des traitements de données à caractère personnel.`,
  },
  {
    title: "9. Modification des CGU",
    content: `Klasbook peut modifier les présentes CGU à tout moment. En cas de modification substantielle (changement tarifaire, limitation de fonctionnalités, modification des droits des utilisateurs), les utilisateurs sont prévenus par e-mail au moins 30 jours à l'avance.

La poursuite de l'utilisation du service après ce délai vaut acceptation des nouvelles CGU. En cas de désaccord, l'utilisateur peut résilier son compte avant l'entrée en vigueur des modifications et bénéficiera d'un remboursement au prorata de la période non consommée.

Version en vigueur depuis : mars 2026`,
  },
  {
    title: "10. Droit applicable et juridiction compétente",
    content: `Les présentes CGU sont régies par le droit belge.

Tout litige relatif à leur interprétation ou leur exécution sera soumis, à défaut de résolution amiable dans un délai de 30 jours, à la compétence exclusive des tribunaux de l'arrondissement judiciaire de Bruxelles.

Pour les consommateurs résidant dans un autre État membre de l'UE, les dispositions impératives de protection du consommateur applicables dans leur pays de résidence sont préservées.

Plateforme de règlement des litiges en ligne (UE) : https://ec.europa.eu/consumers/odr`,
  },
];

export default function CguPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#06090f", color: "#fff", fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* Nav */}
      <nav style={{
        padding: "16px 40px", display: "flex", alignItems: "center",
        justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.07)",
      }}>
        <a href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: GRADIENT, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#fff", fontSize: 16 }}>✦</span>
          </div>
          <span style={{ fontWeight: 900, fontSize: 16, color: "#fff" }}>Klasbook</span>
        </a>
        <a href="/pricing" style={{ color: "rgba(255,255,255,0.6)", textDecoration: "none", fontSize: 13 }}>Tarifs</a>
      </nav>

      <div style={{ maxWidth: 780, margin: "0 auto", padding: "60px 24px 100px" }}>

        {/* Header */}
        <div style={{ marginBottom: 48 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "rgba(255,59,48,0.1)", border: "1px solid rgba(255,59,48,0.2)",
            borderRadius: 20, padding: "5px 14px",
            color: "#FF3B30", fontSize: 12, fontWeight: 700, marginBottom: 16,
          }}>
            📋 Conditions générales
          </div>
          <h1 style={{ fontWeight: 900, fontSize: "clamp(1.8rem, 4vw, 2.6rem)", letterSpacing: "-0.5px", lineHeight: 1.1, marginBottom: 14 }}>
            Conditions Générales d&apos;Utilisation
          </h1>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, lineHeight: 1.7 }}>
            En utilisant Klasbook, vous acceptez les conditions suivantes. Nous avons voulu les rédiger
            de façon claire et compréhensible, sans jargon inutile.
          </p>
        </div>

        {/* Sections */}
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {SECTIONS.map((section, i) => (
            <div key={i} style={{
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 16, padding: "24px 28px",
            }}>
              <h2 style={{ fontWeight: 800, fontSize: 16, color: "#fff", marginBottom: 14 }}>
                {section.title}
              </h2>
              <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 13, lineHeight: 1.85, whiteSpace: "pre-line" }}>
                {section.content.split(/\*\*([^*]+)\*\*/g).map((part, j) =>
                  j % 2 === 1
                    ? <strong key={j} style={{ color: "rgba(255,255,255,0.9)", fontWeight: 700 }}>{part}</strong>
                    : <React.Fragment key={j}>{part}</React.Fragment>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Links */}
        <div style={{ marginTop: 48, display: "flex", gap: 16, flexWrap: "wrap" }}>
          <a href="/vie-privee" style={{
            flex: 1, minWidth: 200, padding: "16px 20px", borderRadius: 14,
            background: "rgba(10,132,255,0.06)", border: "1px solid rgba(10,132,255,0.2)",
            color: "#0A84FF", textDecoration: "none", fontWeight: 700, fontSize: 13,
            textAlign: "center",
          }}>
            🔒 Politique de confidentialité →
          </a>
          <a href="/contact" style={{
            flex: 1, minWidth: 200, padding: "16px 20px", borderRadius: 14,
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
            color: "rgba(255,255,255,0.7)", textDecoration: "none", fontWeight: 700, fontSize: 13,
            textAlign: "center",
          }}>
            📬 Nous contacter →
          </a>
        </div>

        <div style={{ marginTop: 40, textAlign: "center", color: "rgba(255,255,255,0.25)", fontSize: 11 }}>
          En vigueur depuis mars 2026 · Klasbook · Bruxelles, Belgique · Droit belge applicable
        </div>
      </div>
    </div>
  );
}
