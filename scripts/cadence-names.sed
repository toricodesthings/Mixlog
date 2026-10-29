# Rename Cadence design-system names to Mixlog's. Run on any file ported from Cadence:
#   sed -i -E -f scripts/cadence-names.sed <files>
# Longer names first, so a prefix never eats a longer match.
s/twilight-surface-muted/room-surface-muted/g
s/twilight-surface-hover/room-surface-hover/g
s/twilight-text-muted/ink-muted/g
s/twilight-text-soft/ink-soft/g
s/twilight-text/ink/g
s/twilight-border-interactive/line-strong/g
s/twilight-border-light/line-light/g
s/twilight-border/line/g
s/twilight-(void|deep|base|surface|elevated)/room-\1/g
s/accent-on-primary/on-accent/g
s/accent-primary-soft/accent-soft/g
s/accent-primary-dim/accent-dim/g
s/accent-primary/accent/g
s/text-\[var\(--primary-foreground\)\]/text-on-accent/g
s/--primary-foreground/--color-on-accent/g
s/glow-lantern/glow-accent/g
s/\bbg-twilight\b/bg-atmosphere/g
s/data-cadence-/data-/g
s/Cadence's twilight (glass )?aesthetic/Blue Hour/g
