import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Bell, BellOff } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';

const NotificationStatusIndicator = () => {
	const { isSupported, getPermission, isNotificationPreferenceEnabled } = useNotifications();
	const permission = getPermission();
	const isEnabled = permission === 'granted' && isNotificationPreferenceEnabled();

	if (!isSupported) {
		return null; // Don't show anything if notifications aren't supported
	}

	const Icon = isEnabled ? Bell : BellOff;
	const badgeClass = isEnabled
		? 'bg-green-500/10 text-green-600 border-green-200'
		: permission === 'denied'
			? 'bg-red-500/10 text-red-600 border-red-200'
			: 'bg-gray-500/10 text-gray-600 border-gray-200';

	return (
		<div className="flex items-center gap-2">
			<Badge variant={isEnabled ? 'default' : 'secondary'} className={`flex items-center gap-1.5 px-2 py-1 ${badgeClass}`}>
				<Icon className="h-3 w-3" />
				<span className="text-xs font-medium">Notifications</span>
			</Badge>
		</div>
	);
};

export default NotificationStatusIndicator;
