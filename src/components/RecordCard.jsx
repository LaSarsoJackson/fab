import { useState } from "react";
import { CloseIcon, ExternalIcon } from "../app/icons";
import { resolveArceBiographyUrl, resolveArceImageUrl } from "../features/fab/arceLinks";
import { formatRecordLocation } from "../features/locator/burialRecords";
import { buildDirectionsLink } from "../shared/routing";

const clean = (value) => String(value || "").trim();

const RecordPortrait = ({ imageUrl, biographyUrl }) => {
  if (!imageUrl) return null;
  const image = <img src={imageUrl} alt="" className="record-card__portrait" />;
  if (!biographyUrl) return image;
  return (
    <a href={biographyUrl} target="_blank" rel="noreferrer" className="record-card__portrait-link">
      {image}
    </a>
  );
};

const RecordIdentity = ({ record, birth, death, tourContext }) => (
  <div className="record-card__content">
    {record.tourName ? (
      <p className="record-card__source">
        {record.tourName}
        {tourContext ? ` · Place ${tourContext.position} of ${tourContext.total}` : ""}
      </p>
    ) : null}
    <h2 id="record-card-title">{record.displayName}</h2>
    <p className="record-card__location">{formatRecordLocation(record) || "Location not recorded"}</p>
    {(birth || death) ? <p className="record-card__dates">{birth || "?"} – {death || "?"}</p> : null}
    {record.extraTitle ? <p className="record-card__summary">{record.extraTitle}</p> : null}
  </div>
);

const TourNavigation = ({ tourContext }) => {
  if (!tourContext) return null;
  return (
    <nav className="record-card__tour-navigation" aria-label="Tour places">
      <button
        type="button"
        className="text-button"
        aria-label="Previous place"
        disabled={!tourContext.onPrevious}
        onClick={tourContext.onPrevious || undefined}
      >
        Previous
      </button>
      <button type="button" className="text-button" onClick={tourContext.onOverview}>
        All places
      </button>
      <button
        type="button"
        className="text-button"
        aria-label="Next place"
        disabled={!tourContext.onNext}
        onClick={tourContext.onNext || undefined}
      >
        Next
      </button>
    </nav>
  );
};

const RecordActions = ({ biographyUrl, directions, onUnpin, tourContext }) => (
  <div className="record-card__actions">
    {directions ? (
      <a
        className="primary-button"
        href={directions.href}
        target={directions.target}
        rel={directions.target === "_blank" ? "noreferrer" : undefined}
      >
        Navigate <ExternalIcon />
      </a>
    ) : null}
    {biographyUrl ? (
      <a className="secondary-button" href={biographyUrl} target="_blank" rel="noreferrer">
        Read biography <ExternalIcon />
      </a>
    ) : null}
    {!tourContext ? <button type="button" className="secondary-button" onClick={onUnpin}>Unpin</button> : null}
  </div>
);

export default function RecordCard({
  record,
  open,
  shareUrl,
  onClose,
  onUnpin,
  tourContext = null,
}) {
  const [shareStatus, setShareStatus] = useState("");
  if (!record || !open) return null;

  const birth = clean(record.birth || record.Birth);
  const death = clean(record.death || record.Death);
  const portrait = clean(record.portraitImageName);
  const biographyUrl = resolveArceBiographyUrl(record.biographyLink || record.Tour_Bio);
  const imageUrl = portrait
    ? resolveArceImageUrl(portrait)
    : "";
  const directions = Array.isArray(record.coordinates)
    ? buildDirectionsLink({
      latitude: Number(record.coordinates[1]),
      longitude: Number(record.coordinates[0]),
      label: record.displayName,
      userAgent: navigator.userAgent,
    })
    : null;

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: record.displayName, url: shareUrl });
        setShareStatus("Shared");
        return;
      }
      await navigator.clipboard.writeText(shareUrl);
      setShareStatus("Link copied");
    } catch (error) {
      if (error?.name !== "AbortError") setShareStatus("Unable to share this link");
    }
  };

  return (
    <article className="record-card" aria-labelledby="record-card-title">
      <button type="button" className="icon-button record-card__close" onClick={onClose} aria-label="Close details">
        <CloseIcon />
      </button>
      <div className="record-card__body">
        <RecordPortrait imageUrl={imageUrl} biographyUrl={biographyUrl} />
        <RecordIdentity record={record} birth={birth} death={death} tourContext={tourContext} />
      </div>
      <TourNavigation tourContext={tourContext} />
      <RecordActions
        biographyUrl={biographyUrl}
        directions={directions}
        onUnpin={onUnpin}
        tourContext={tourContext}
      />
      <details className="record-card__share">
        <summary>Share pinned grave</summary>
        <button type="button" className="text-button" onClick={share}>Share link</button>
        {shareStatus ? <span role="status">{shareStatus}</span> : null}
      </details>
    </article>
  );
}
