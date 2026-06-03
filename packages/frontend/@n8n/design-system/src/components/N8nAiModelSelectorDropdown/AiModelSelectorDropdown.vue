<script
	setup
	lang="ts"
	generic="TData extends AiModelSelectorMenuItemData = AiModelSelectorMenuItemData"
>
import { computed, ref, useCssModule, useTemplateRef } from 'vue';
import N8nButton from '../N8nButton';
import N8nDropdownMenu from '../N8nDropdownMenu/DropdownMenu.vue';
import N8nIcon from '../N8nIcon';
import N8nText from '../N8nText';
import N8nTooltip from '../N8nTooltip';
import { truncateBeforeLast } from '@n8n/utils/string/truncate';
import type {
	AiModelSelectorMenuItem,
	AiModelSelectorMenuItemData,
} from './AiModelSelectorDropdown.types';
import { Primitive } from 'reka-ui';

const {
	items,
	selectedLabel,
	selectedCredentialName,
	credentialsMissing = false,
	credentialsMissingLabel,
	noMatchLabel,
	text = false,
	dataTestId,
	credentialDataTestId,
	maxSelectedNameChars,
} = defineProps<{
	items: Array<AiModelSelectorMenuItem<TData>>;
	selectedLabel: string;
	selectedCredentialName?: string;
	credentialsMissing?: boolean;
	credentialsMissingLabel: string;
	noMatchLabel: string;
	text?: boolean;
	dataTestId: string;
	credentialDataTestId: string;
	maxSelectedNameChars: number;
}>();

const emit = defineEmits<{
	select: [id: string];
	search: [query: string];
}>();

defineSlots<{
	'trigger-leading'?: (props: { ui: { class: string } }) => void;
	'item-leading'?: (props: { item: AiModelSelectorMenuItem<TData>; ui: { class: string } }) => void;
}>();

const dropdownRef = useTemplateRef('dropdownRef');
const searchQuery = ref('');
const $style = useCssModule();

const extraPopperClass = computed(() =>
	[$style.component, searchQuery.value ? $style.searching : ''].join(' '),
);

function handleSearch(query: string) {
	searchQuery.value = query;
	emit('search', query);
}

defineExpose({
	open: () => dropdownRef.value?.open(),
});
</script>

<template>
	<N8nDropdownMenu
		ref="dropdownRef"
		:items="items"
		teleported
		placement="bottom-start"
		:extra-popper-class="extraPopperClass"
		searchable
		:empty-text="searchQuery ? noMatchLabel : undefined"
		@search="handleSearch"
		@select="emit('select', $event)"
	>
		<template #trigger>
			<Primitive as="button" :class="$style.dropdownButton" :data-test-id="dataTestId">
				<div :class="$style.selected">
					<slot name="trigger-leading" :ui="{ class: $style.icon }" />
					<N8nText bold truncate :class="$style.selectedLabel">
						{{ truncateBeforeLast(selectedLabel, maxSelectedNameChars) }}
					</N8nText>
					<N8nText
						v-if="selectedCredentialName"
						size="small"
						bold
						color="text-light"
						:data-test-id="credentialDataTestId"
					>
						{{ truncateBeforeLast(selectedCredentialName, maxSelectedNameChars) }}
					</N8nText>
					<N8nText v-else-if="credentialsMissing" size="xsmall" color="danger">
						<N8nIcon
							icon="node-validation-error"
							size="xsmall"
							:class="$style.credentialsMissingIcon"
						/>
						{{ credentialsMissingLabel }}
					</N8nText>
				</div>
				<N8nIcon :class="$style.chevron" icon="chevron-down" size="medium" />
			</Primitive>
		</template>

		<template #item-leading="{ item, ui }">
			<slot name="item-leading" :item="item" :ui="ui" />
			<N8nIcon
				v-if="!item.data && item.icon?.type === 'icon'"
				:icon="item.icon.value"
				:class="ui.class"
				color="text-light"
				size="large"
			/>
			<span v-else-if="!item.data && item.icon?.type === 'emoji'" :class="[$style.emoji, ui.class]">
				{{ item.icon.value }}
			</span>
		</template>

		<template #item-label="{ item, ui }">
			<template v-if="item.data?.parts">
				<div :class="[$style.flattenedLabel, ui.class]">
					<template v-for="(part, index) in item.data.parts" :key="index">
						<N8nText v-if="index > 0" color="text-light" :class="$style.separator">
							<N8nIcon icon="chevron-right" size="small" />
						</N8nText>
						<N8nText
							size="medium"
							:color="index === item.data.parts.length - 1 ? 'text-dark' : 'text-base'"
						>
							{{ part }}
						</N8nText>
					</template>
				</div>
			</template>
			<N8nText v-else :class="ui.class" size="medium" color="text-dark">
				{{ item.label }}
			</N8nText>
		</template>

		<template #item-trailing="{ item, ui }">
			<N8nTooltip
				v-if="item.data?.description"
				:content="truncateBeforeLast(item.data.description, 200, 0)"
				placement="right"
				:teleported="false"
			>
				<N8nIcon icon="info" size="medium" color="text-light" :class="$style.infoIcon" />
			</N8nTooltip>
		</template>
	</N8nDropdownMenu>
</template>

<style lang="scss" module>
@use '../../css/mixins/focus';
.component {
	width: fit-content;
}

.dropdownButton {
	flex: 1;
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: center;
	height: var(--height--lg);
	padding: 0 var(--spacing--xs);
	gap: var(--spacing--xs);
	border: var(--border);
	background-color: var(--background--surface);
	border-radius: var(--radius--2xs);
	font-size: var(--font-size--sm);
	outline: none;

	&:focus-visible {
		@include focus.focus-ring;
		border-color: var(--focus--border-color) !important;
		transition: none;
	}

	&:hover {
		background-color: color-mix(in srgb, var(--background--surface) 90%, black 5%);
	}

	&:active,
	&[aria-expanded='true'],
	:global([aria-expanded='true']) & {
		background-color: color-mix(in srgb, var(--background--surface) 90%, black 10%);
	}
}

.credentialsMissingIcon {
	display: inline-block;
	margin-bottom: calc(-1 * var(--border-width));
}

.selected {
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: flex-start;
	flex: 1;
	min-width: 0;
	gap: var(--spacing--2xs);
	overflow: hidden;
}

.chevron {
	color: var(--text-color--subtler);
}

.icon {
	min-width: var(--spacing--sm);
	min-height: var(--spacing--sm);
}

.infoIcon {
	flex-shrink: 0;
	margin-inline: var(--spacing--5xs);
}

.emoji {
	font-size: var(--font-size--sm);
	line-height: 1;
}

.flattenedLabel {
	display: flex;
	align-items: center;
	gap: var(--spacing--4xs);
	overflow: hidden;
	flex-grow: 1;
	white-space: nowrap;
}

.separator {
	flex-shrink: 0;
	display: inline-flex;
	align-items: center;
}
</style>
