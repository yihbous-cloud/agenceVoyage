import Icon from "./Icon";

// En-tête de page de la charte (designadmin.md) : tuile icône 44px, titre
// 24px, description, actions alignées en bas à droite.
// Composant serveur : textes en français, traduits par le traducteur DOM.
export default function PageHeader({ icon, title, description, children, titleTranslate }) {
  return (
    <div className="gf-page-head">
      <div className="gf-page-head-main">
        {icon && (
          <div className="gf-page-icon">
            <Icon name={icon} size={24} fill />
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          <h1 translate={titleTranslate}>{title}</h1>
          {description && <p className="gf-page-desc">{description}</p>}
        </div>
      </div>
      {children && <div className="gf-page-actions">{children}</div>}
    </div>
  );
}
