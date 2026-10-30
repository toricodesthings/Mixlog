import { Switch } from "../primitives";
import { SettingsRow } from "./SettingsLayout";

export function SwitchSetting({ title, description, checked, onChange, label = title }: {
    title: string;
    description?: string;
    /** Spoken name when the visible title alone is ambiguous. */
    label?: string;
    checked: boolean;
    onChange: (value: boolean) => void;
}) {
    return (
        <SettingsRow title={title} description={description}>
            <Switch checked={checked} aria-label={label} onCheckedChange={onChange} />
        </SettingsRow>
    );
}
