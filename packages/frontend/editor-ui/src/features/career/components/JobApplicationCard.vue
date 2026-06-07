<script lang="ts" setup>
import { ref } from 'vue';
import { N8nButton, N8nBadge, N8nCard } from '@n8n/design-system';
import type { ApplicationStatus, JobApplication } from '../stores/careerApplications.store';

const props = defineProps<{ application: JobApplication }>();
const emit = defineEmits<{
	(e: 'status-change', id: string, status: ApplicationStatus): void;
	(e: 'remove', id: string): void;
	(e: 'view-cv', application: JobApplication): void;
}>();

const STATUS_LABELS: Record<ApplicationStatus, string> = {
	to_apply: 'À postuler',
	applied: 'Postulé',
	rejected: 'Refusé',
	interview: 'Entretien',
};

const STATUS_TYPES: Record<ApplicationStatus, 'success' | 'warning' | 'danger' | 'info'> = {
	to_apply: 'info',
	applied: 'success',
	rejected: 'danger',
	interview: 'warning',
};

const showStatusMenu = ref(false);

function setStatus(status: ApplicationStatus) {
	emit('status-change', props.application.id, status);
	showStatusMenu.value = false;
}
</script>

<template>
	<N8nCard :class="$style.card">
		<div :class="$style.header">
			<div :class="$style.titleBlock">
				<span :class="$style.jobTitle">{{ application.jobTitle }}</span>
				<span :class="$style.company">{{ application.company }}</span>
			</div>
			<div :class="$style.statusWrapper">
				<N8nBadge
					:type="STATUS_TYPES[application.status]"
					:class="$style.statusBadge"
					@click="showStatusMenu = !showStatusMenu"
				>
					{{ STATUS_LABELS[application.status] }}
				</N8nBadge>
				<div v-if="showStatusMenu" :class="$style.statusMenu">
					<button
						v-for="(label, key) in STATUS_LABELS"
						:key="key"
						:class="[$style.statusOption, { [$style.active]: key === application.status }]"
						@click="setStatus(key as ApplicationStatus)"
					>
						{{ label }}
					</button>
				</div>
			</div>
		</div>

		<div :class="$style.meta">
			<span v-if="application.location" :class="$style.metaItem">
				<span :class="$style.metaIcon">📍</span>
				{{ application.location }}
			</span>
			<span v-if="application.salary" :class="$style.metaItem">
				<span :class="$style.metaIcon">💰</span>
				{{ application.salary }}
			</span>
			<span :class="$style.metaItem">
				<span :class="$style.metaIcon">🗓</span>
				{{ new Date(application.addedAt).toLocaleDateString('fr-FR') }}
			</span>
		</div>

		<div v-if="application.tailoredCv" :class="$style.cvPreview">
			{{ application.tailoredCv.substring(0, 120) }}…
		</div>

		<div :class="$style.actions">
			<N8nButton
				v-if="application.tailoredCv"
				size="small"
				type="secondary"
				@click="emit('view-cv', application)"
			>
				Voir le CV adapté
			</N8nButton>
			<N8nButton
				v-if="application.applyUrl"
				size="small"
				type="primary"
				tag="a"
				:href="application.applyUrl"
				target="_blank"
				rel="noopener noreferrer"
			>
				Postuler sur Indeed
			</N8nButton>
			<N8nButton
				size="small"
				type="tertiary"
				:class="$style.removeBtn"
				@click="emit('remove', application.id)"
			>
				Supprimer
			</N8nButton>
		</div>
	</N8nCard>
</template>

<style lang="scss" module>
.card {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--sm);
	padding: var(--spacing--md);
	height: 100%;
	box-sizing: border-box;
	transition: box-shadow 0.15s ease;

	&:hover {
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
	}
}

.header {
	display: flex;
	justify-content: space-between;
	align-items: flex-start;
	gap: var(--spacing--sm);
}

.titleBlock {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--3xs);
	min-width: 0;
}

.jobTitle {
	font-size: var(--font-size--md);
	font-weight: var(--font-weight--bold);
	color: var(--color--text-dark);
	line-height: 1.3;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.company {
	font-size: var(--font-size--sm);
	color: var(--color--text-base);
}

.statusWrapper {
	position: relative;
	flex-shrink: 0;
}

.statusBadge {
	cursor: pointer;
	user-select: none;
}

.statusMenu {
	position: absolute;
	right: 0;
	top: calc(100% + 4px);
	background: var(--color--background-light);
	border: 1px solid var(--color--foreground-light);
	border-radius: var(--border-radius--base);
	z-index: 100;
	min-width: 120px;
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
	overflow: hidden;
}

.statusOption {
	display: block;
	width: 100%;
	padding: var(--spacing--xs) var(--spacing--sm);
	text-align: left;
	background: none;
	border: none;
	cursor: pointer;
	font-size: var(--font-size--sm);
	color: var(--color--text-dark);

	&:hover {
		background: var(--color--background-base);
	}

	&.active {
		font-weight: var(--font-weight--bold);
		color: var(--color--primary);
	}
}

.meta {
	display: flex;
	flex-wrap: wrap;
	gap: var(--spacing--xs);
}

.metaItem {
	display: flex;
	align-items: center;
	gap: var(--spacing--3xs);
	font-size: var(--font-size--xs);
	color: var(--color--text-base);
}

.metaIcon {
	font-size: 12px;
}

.cvPreview {
	font-size: var(--font-size--xs);
	color: var(--color--text-light);
	line-height: 1.5;
	background: var(--color--background-base);
	padding: var(--spacing--xs);
	border-radius: var(--border-radius--base);
	border-left: 3px solid var(--color--primary);
	font-style: italic;
}

.actions {
	display: flex;
	gap: var(--spacing--xs);
	flex-wrap: wrap;
	margin-top: auto;
	padding-top: var(--spacing--xs);
}

.removeBtn {
	margin-left: auto;
	color: var(--color--danger) !important;
}
</style>
