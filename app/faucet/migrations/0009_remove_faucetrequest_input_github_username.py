# Generated by Django 2.0.3 on 2018-04-13 14:27

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('faucet', '0008_auto_20180413_0725'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='faucetrequest',
            name='input_github_username',
        ),
    ]