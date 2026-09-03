import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";

type SelectOption = {
  value: string;
  label: string;
};

type SelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  ariaLabel: string;
  className?: string;
};

export function Select({ value, onValueChange, options, ariaLabel, className = "" }: SelectProps) {
  return <SelectPrimitive.Root value={value} onValueChange={onValueChange}>
    <SelectPrimitive.Trigger className={`ui-select-trigger ${className}`} aria-label={ariaLabel}>
      <SelectPrimitive.Value />
      <SelectPrimitive.Icon className="ui-select-chevron"><ChevronDown size={14} /></SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content className="ui-select-content" position="popper" sideOffset={5}>
        <SelectPrimitive.ScrollUpButton className="ui-select-scroll"><ChevronUp size={14} /></SelectPrimitive.ScrollUpButton>
        <SelectPrimitive.Viewport className="ui-select-viewport">
          {options.map((option) => <SelectPrimitive.Item className="ui-select-item" value={option.value} key={option.value}>
            <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
            <SelectPrimitive.ItemIndicator className="ui-select-check"><Check size={14} /></SelectPrimitive.ItemIndicator>
          </SelectPrimitive.Item>)}
        </SelectPrimitive.Viewport>
        <SelectPrimitive.ScrollDownButton className="ui-select-scroll"><ChevronDown size={14} /></SelectPrimitive.ScrollDownButton>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  </SelectPrimitive.Root>;
}
