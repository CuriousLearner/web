
# Third Party Stuff
from django.urls import reverse

from rest_framework import serializers

from .models import Job


class JobSerializer(serializers.ModelSerializer):
    company_avatar = serializers.SerializerMethodField()
    job_type = serializers.CharField(source='get_job_type_display')

    def get_company_avatar(self, obj):
        return reverse('org_avatar', args=[obj.posted_by])

    class Meta:
        model = Job
        fields = (
            'id', 'title', 'description', 'github_profile_link', 'apply_url',
            'is_active', 'skills', 'expiry_date', 'location', 'job_type', 'url',
            'company', 'apply_email', 'posted_by_user_profile_url',
            'posted_by', 'company_avatar', 'created_at'
        )
