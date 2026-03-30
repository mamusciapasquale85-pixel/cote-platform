import React from "react";

const GRADIENT = "linear-gradient(135deg, #FF3B30 0%, #0A84FF 100%)";

const SECTIONS = [
  {
    title: "1. Responsable du traitement",
    content: `Klasbook est édité par Pasquale De Michele, domicilié en Région de Bruxelles-Capitale, Belgique (ci-après « Klasbook », « nous »).

Contact : privacy@klasbook.be

Pour toute question relative à vos données personnelles, vous pouvez nous contacter à l'adresse ci-dessus. Nous répondons dans un délai maximum de 30 jours calendriers.`,
  },
  {
    title: "2. Données collectées",
    content: `Nous collectons uniquement les données strictement nécessaires au fonctionnement du service :

**Données d'inscription :**
Adresse e-mail, prénom et nom, établissement scolaire, matière(s) enseignée(s), classe(s).

**Données d'utilisation :**
Exercices générés (sujet, niveau, contenu), historique de connexion, préférences de l'application.

**Données élèves :**
Prénom uniquement (optionnel, saisi par l'élève lui-même pour personnaliser les corrections). Aucune donnée d'identification directe des élèves n'est collectée par défaut.

**Données de paiement :**
Traitées exclusivement par Stripe Inc. Klasbook ne conserve aucun numéro de carte bancaire.

**Données techniques :**
Adresse IP (anonymisée), type de navigateur, logs d'erreurs techniques.`,
  },
  {
    title: "3. Bases légales du traitement (RGPD art. 6)",
    content: `Nous traitons vos données sur les bases légales suivantes :

**Exécution du contrat (art. 6.1.b) :** pour la fourniture du service Klasbook (génération d'exercices, bulletins, gestion de classe).

**Intérêt légitime (art. 6.1.f) :** pour améliorer nos services, détecter les fraudes, assurer la sécurité de la plateforme.

**Consentement (art. 6.1.a) :** pour l'envoi de communications marketing. Vous pouvez retirer ce consentement à tout moment.

**Obligation légale (art. 6.1.c) :** pour la conservation de données de facturation conformément au droit belge.`,
  },
  {
    title: "4. Données des mineurs",
    content: `Klasbook est un outil destiné aux professionnels de l'éducation (enseignants, directions). Il n'est pas directement accessible aux élèves mineurs pour la création de compte.

Les données des élèves (prénoms, résultats, évaluations) sont saisies et gérées exclusivement par les enseignants ou directions d'établissement, qui agissent en tant que responsables de traitement distincts pour ces données.

Les établissements scolaires utilisant Klasbook (plan École) doivent s'assurer d'avoir l'autorisation légale nécessaire pour traiter les données des élèves dans leur contexte national et régional (FWB/RGPD).

Un accord de traitement des données (DPA) est fourni aux établissements scolaires sur demande.`,
  },
  {
    title: "5. Sous-traitants et transferts de données",
    content: `Nous faisons appel aux sous-traitants suivants, tous conformes au RGPD :

**Supabase Inc. (USA)** — hébergement base de données. Serveurs localisés dans l'Union européenne (région eu-west-1). Accord de traitement signé. Standard contractuel UE applicable.

**Anthropic PBC (USA)** — modèle d'IA pour la génération d'exercices. Les contenus envoyés sont des prompts pédagogiques anonymisés. Pas de données personnelles identifiables transmises à Anthropic.

**Stripe Inc. (USA)** — paiement en ligne. Certifié PCI DSS niveau 1. Transfert encadré par des clauses contractuelles types UE.

**Vercel Inc. (USA)** — hébergement applicatif. Infrastructure Edge Network avec présence en Europe.

Aucune donnée n'est vendue à des tiers. Aucune donnée n'est utilisée à des fins publicitaires.`,
  },
  {
    title: "6. Durée de conservation",
    content: `**Données de compte :** conservées pendant toute la durée du compte actif + 2 ans après résiliation.

**Exercices générés :** conservés tant que le compte est actif. Supprimés 90 jours après la clôture du compte.

**Données de facturation :** conservées 7 ans conformément au droit comptable belge (article III.85 du Code de droit économique).

**Logs techniques :** conservés 90 jours glissants.

**Données de backup :** les sauvegardes sont conservées 30 jours maximum, puis supprimées.`,
  },
  {
    title: "7. Vos droits (RGPD Chapitre III)",
    content: `Conformément au RGPD, vous disposez des droits suivants :

**Droit d'accès (art. 15) :** obtenir une copie de toutes vos données personnelles.

**Droit de rectification (art. 16) :** corriger des données inexactes ou incomplètes.

**Droit à l'effacement (art. 17) :** demander la suppression de vos données ("droit à l'oubli").

**Droit à la limitation (art. 18) :** suspendre temporairement le traitement de vos données.

**Droit à la portabilité (art. 20) :** recevoir vos données dans un format structuré et lisible par machine (JSON/CSV).

**Droit d'opposition (art. 21) :** vous opposer à certains traitements, notamment à des fins de profilage.

Pour exercer ces droits, écrivez à : privacy@klasbook.be

Vous avez également le droit d'introduire une réclamation auprès de l'Autorité de Protection des Données (APD) belge : www.autoriteprotectiondonnees.be`,
  },
  {
    title: "8. Sécurité des données",
    content: `Klasbook met en œuvre des mesures techniques et organisationnelles appropriées :

— Chiffrement des données en transit (HTTPS/TLS 1.3)
— Chiffrement des données au repos (AES-256)
— Authentification sécurisée (Supabase Auth avec sessions chiffrées)
— Contrôle d'accès par Row Level Security (RLS) : chaque utilisateur ne peut accéder qu'à ses propres données
— Accès administrateur limité et journalisé
— Politique de mises à jour de sécurité régulières`,
  },
  {
    title: "9. Cookies",
    content: `Klasbook utilise uniquement les cookies strictement nécessaires au fonctionnement du service :

**Cookies de session Supabase :** maintiennent la connexion de l'utilisateur. Durée : session + 7 jours (si "rester connecté" activé). Aucun cookie publicitaire ou de tracking tiers n'est déposé.

Conformément à la directive ePrivacy, ces cookies essentiels ne requièrent pas de consentement préalable.`,
  },
  {
    title: "10. Modifications de cette politique",
    content: `Nous pouvons modifier cette politique à tout moment. En cas de modification substantielle, vous serez informé par e-mail au moins 15 jours à l'avance. La poursuite de l'utilisation du service après cette période vaut acceptation de la nouvelle politique.

Dernière mise à jour : mars 2026.`,
  },
];

export default function ViePriveePage() {
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
            background: "rgba(10,132,255,0.1)", border: "1px solid rgba(10,132,255,0.2)",
            borderRadius: 20, padding: "5px 14px",
            color: "#0A84FF", fontSize: 12, fontWeight: 700, marginBottom: 16,
          }}>
            🔒 Conformité RGPD
          </div>
          <h1 style={{ fontWeight: 900, fontSize: "clamp(1.8rem, 4vw, 2.6rem)", letterSpacing: "-0.5px", lineHeight: 1.1, marginBottom: 14 }}>
            Politique de confidentialité
          </h1>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, lineHeight: 1.7 }}>
            Chez Klasbook, la protection de vos données — et celles de vos élèves — est une priorité absolue.
            Cette politique décrit comment nous collectons, utilisons et protégeons vos informations personnelles,
            conformément au Règlement Général sur la Protection des Données (RGPD / UE 2016/679)
            et la législation belge applicable.
          </p>
        </div>

        {/* Sections */}
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
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

        {/* Contact box */}
        <div style={{
          marginTop: 48, background: "rgba(10,132,255,0.06)",
          border: "1px solid rgba(10,132,255,0.2)", borderRadius: 16, padding: "24px 28px",
          textAlign: "center",
        }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>📬</div>
          <div style={{ fontWeight: 800, fontSize: 15, color: "#fff", marginBottom: 6 }}>
            Une question sur vos données ?
          </div>
          <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, marginBottom: 16 }}>
            Notre délégué à la protection des données répond dans les 30 jours.
          </div>
          <a href="mailto:privacy@klasbook.be" style={{
            display: "inline-block", padding: "10px 24px", borderRadius: 10,
            background: GRADIENT, color: "#fff", fontWeight: 700, fontSize: 13,
            textDecoration: "none",
          }}>
            privacy@klasbook.be
          </a>
        </div>

        <div style={{ marginTop: 40, textAlign: "center", color: "rgba(255,255,255,0.25)", fontSize: 11 }}>
          Dernière mise à jour : mars 2026 · Klasbook · Bruxelles, Belgique
        </div>
      </div>
    </div>
  );
}
